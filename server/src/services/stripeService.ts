import Stripe from "stripe";
import { pool } from "../db/connection";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || "";
const STRIPE_PLATFORM_ACCOUNT_ID = process.env.STRIPE_PLATFORM_ACCOUNT_ID || "";
const STRIPE_CLIENT_ID = process.env.STRIPE_CLIENT_ID || "";
const DEFAULT_COMMISSION_RATE = parseFloat(process.env.PLATFORM_COMMISSION_RATE || "0.10");
const BASE_CURRENCY = (process.env.BASE_CURRENCY || "GBP").toLowerCase();

export class StripeService {
  private stripe: Stripe;
  private platformAccountId?: string;

  constructor() {
    if (!STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }

    this.stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2025-12-15.clover",
    });
  }

  private async getPlatformAccount(): Promise<Stripe.Account> {
    if (this.platformAccountId) {
      return this.stripe.accounts.retrieve(this.platformAccountId);
    }

    const account = STRIPE_PLATFORM_ACCOUNT_ID
      ? await this.stripe.accounts.retrieve(STRIPE_PLATFORM_ACCOUNT_ID)
      : await this.stripe.accounts.retrieve();

    this.platformAccountId = account.id;
    return account;
  }

  private async getCommissionRate(): Promise<number> {
    try {
      const result = await pool.query(
        "SELECT setting_value FROM platform_settings WHERE setting_key = 'commission_rate'"
      );

      if (result.rows.length > 0 && result.rows[0].setting_value) {
        const rate = parseFloat(result.rows[0].setting_value);
        if (!isNaN(rate) && rate >= 0 && rate <= 1) {
          return rate;
        }
      }

      console.warn("[Stripe] Commission rate not found in database or invalid, using default:", DEFAULT_COMMISSION_RATE);
      return DEFAULT_COMMISSION_RATE;
    } catch (error: any) {
      console.error("[Stripe] Failed to fetch commission rate from database, using default:", error?.message);
      return DEFAULT_COMMISSION_RATE;
    }
  }

  async createConnectAccount(retailerId: string, email: string, businessName: string) {
    try {
      const existing = await pool.query(
        "SELECT stripe_account_id FROM stripe_connect_accounts WHERE retailer_id = $1",
        [retailerId]
      );
      if (existing.rows.length > 0) {
        const existingAccountId = existing.rows[0].stripe_account_id;
        const existingAccount = await this.stripe.accounts.retrieve(existingAccountId);
        return existingAccount;
      }

      const account = await this.getPlatformAccount();

      await pool.query(
        `INSERT INTO stripe_connect_accounts (retailer_id, stripe_account_id, onboarding_completed, charges_enabled, payouts_enabled)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (retailer_id) 
         DO UPDATE SET stripe_account_id = $2, updated_at = CURRENT_TIMESTAMP`,
        [
          retailerId,
          account.id,
          true,
          account.charges_enabled,
          account.payouts_enabled,
        ]
      );

      return account;
    } catch (error: any) {
      console.error("[Stripe] Failed to connect account:", error);
      throw error;
    }
  }

  getOAuthAuthorizeUrl(opts: {
    retailerId: string;
    email: string;
    businessName?: string;
    redirectUri: string;
    state: string;
  }) {
    if (!STRIPE_CLIENT_ID) {
      throw new Error("STRIPE_CLIENT_ID environment variable is not set");
    }

    const url = this.stripe.oauth.authorizeUrl({
      response_type: "code",
      client_id: STRIPE_CLIENT_ID,
      scope: "read_write",
      redirect_uri: opts.redirectUri,
      state: opts.state,
      stripe_user: {
        email: opts.email,
        business_name: opts.businessName,
      },
    });

    return url;
  }

  async exchangeOAuthCode(code: string, retailerId: string) {
    if (!STRIPE_CLIENT_ID) {
      throw new Error("STRIPE_CLIENT_ID environment variable is not set");
    }

    const tokenResponse = await this.stripe.oauth.token({
      grant_type: "authorization_code",
      code,
    });

    const accountId = tokenResponse.stripe_user_id;
    if (!accountId) {
      throw new Error("Failed to retrieve Stripe account id from OAuth token");
    }

    const account = await this.stripe.accounts.retrieve(accountId);

    await pool.query(
      `INSERT INTO stripe_connect_accounts (retailer_id, stripe_account_id, onboarding_completed, charges_enabled, payouts_enabled, details_submitted)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (retailer_id)
       DO UPDATE SET stripe_account_id = $2, onboarding_completed = $3, charges_enabled = $4, payouts_enabled = $5, details_submitted = $6, updated_at = CURRENT_TIMESTAMP`,
      [
        retailerId,
        accountId,
        account.details_submitted || false,
        account.charges_enabled,
        account.payouts_enabled,
        account.details_submitted || false,
      ]
    );

    return account;
  }

  async createAccountLink(accountId: string, returnUrl: string, refreshUrl: string) {
    try {
      const platformAccount = await this.getPlatformAccount();
      if (accountId === platformAccount.id) {
        throw new Error("No onboarding required for existing platform Stripe account");
      }

      const accountLink = await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: "account_onboarding",
      });

      return accountLink;
    } catch (error: any) {
      console.error("[Stripe] Failed to create account link:", error);
      throw error;
    }
  }

  async createTransferToConnectedAccount(params: {
    retailerId: string;
    amountBase: number;
    currency?: string;
    metadata?: Record<string, string>;
  }) {
    const currency = (params.currency || BASE_CURRENCY).toLowerCase();
    if (params.amountBase <= 0) {
      throw new Error("Transfer amount must be greater than zero");
    }

    const accountResult = await pool.query(
      "SELECT stripe_account_id, payouts_enabled FROM stripe_connect_accounts WHERE retailer_id = $1",
      [params.retailerId]
    );

    if (accountResult.rows.length === 0) {
      throw new Error("Stripe account not connected for this retailer");
    }

    const stripeAccountId = accountResult.rows[0].stripe_account_id;
    const payoutsEnabled = accountResult.rows[0].payouts_enabled;

    if (!stripeAccountId || payoutsEnabled === false) {
      throw new Error("Stripe payouts are not enabled for this retailer");
    }

    const amountInMinor = Math.round(params.amountBase * 100);

    const transfer = await this.stripe.transfers.create({
      amount: amountInMinor,
      currency,
      destination: stripeAccountId,
      description: "Retailer payout",
      metadata: params.metadata,
    });

    return transfer;
  }

  async createCheckoutSession(
    orderId: string,
    retailerId: string,
    amount: number,
    currency: string = "gbp",
    successUrl: string,
    cancelUrl: string,
    customerEmail?: string
  ) {
    try {
      const accountResult = await pool.query(
        "SELECT stripe_account_id, charges_enabled FROM stripe_connect_accounts WHERE retailer_id = $1",
        [retailerId]
      );

      if (accountResult.rows.length === 0) {
        throw new Error("Retailer Stripe account not found");
      }

      const stripeAccountId = accountResult.rows[0].stripe_account_id;
      const chargesEnabled = accountResult.rows[0].charges_enabled;

      if (!chargesEnabled) {
        throw new Error("Retailer Stripe account is not ready to accept payments");
      }

      const commissionRate = await this.getCommissionRate();
      const platformCommission = amount * commissionRate;
      const retailerAmount = amount - platformCommission;

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: `Order ${orderId}`,
                description: `Payment for order ${orderId}`,
              },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: customerEmail,
        payment_intent_data: {
          application_fee_amount: Math.round(platformCommission * 100),
          transfer_data: {
            destination: stripeAccountId,
          },
          metadata: {
            order_id: orderId,
            retailer_id: retailerId,
          },
        },
        metadata: {
          order_id: orderId,
          retailer_id: retailerId,
        },
        automatic_tax: {
          enabled: false,
        },
      });

      return session;
    } catch (error: any) {
      console.error("[Stripe] Failed to create checkout session:", error);
      throw error;
    }
  }

  async handleWebhook(event: Stripe.Event) {
    try {
      switch (event.type) {
        case "checkout.session.completed":
          const session = event.data.object as Stripe.Checkout.Session;
          await this.handleCheckoutCompleted(session);
          break;

        case "payment_intent.succeeded":
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          await this.handlePaymentSucceeded(paymentIntent);
          break;

        case "account.updated":
          const account = event.data.object as Stripe.Account;
          await this.handleAccountUpdated(account);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error: any) {
      console.error("[Stripe] Webhook error:", error);
      throw error;
    }
  }

  constructWebhookEvent(payload: string | Buffer, signature: string, secret: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const orderId = session.metadata?.order_id;
    if (!orderId) return;

    await pool.query(
      `UPDATE orders 
       SET status = 'processing', 
           stripe_session_id = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [session.id, orderId]
    );
  }

  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    const orderId = paymentIntent.metadata?.order_id;
    const retailerId = paymentIntent.metadata?.retailer_id;
    
    if (!orderId || !retailerId) return;

    const commissionRate = await this.getCommissionRate();
    const totalAmount = paymentIntent.amount / 100;
    const platformCommission = totalAmount * commissionRate;
    const retailerAmount = totalAmount - platformCommission;

    await pool.query(
      `UPDATE orders 
       SET stripe_payment_intent_id = $1,
           platform_commission = $2,
           retailer_amount = $3,
           status = 'processing',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [paymentIntent.id, platformCommission, retailerAmount, orderId]
    );

    if (paymentIntent.transfer_data?.destination) {
      await pool.query(
        `UPDATE orders SET stripe_transfer_id = $1 WHERE id = $2`,
        [paymentIntent.transfer_data.destination, orderId]
      );
    }
  }

  private async handleAccountUpdated(account: Stripe.Account) {
    await pool.query(
      `UPDATE stripe_connect_accounts 
       SET onboarding_completed = $1,
           charges_enabled = $2,
           payouts_enabled = $3,
           details_submitted = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE stripe_account_id = $5`,
      [
        account.details_submitted || false,
        account.charges_enabled,
        account.payouts_enabled,
        account.details_submitted || false,
        account.id,
      ]
    );
  }

  async getAccountStatus(retailerId: string) {
    try {
      const result = await pool.query(
        "SELECT * FROM stripe_connect_accounts WHERE retailer_id = $1",
        [retailerId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const account = result.rows[0];

      if (account.stripe_account_id) {
        const stripeAccount = await this.stripe.accounts.retrieve(account.stripe_account_id);
        return {
          ...account,
          charges_enabled: stripeAccount.charges_enabled,
          payouts_enabled: stripeAccount.payouts_enabled,
          details_submitted: stripeAccount.details_submitted,
        };
      }

      return account;
    } catch (error: any) {
      console.error("[Stripe] Failed to get account status:", error);
      throw error;
    }
  }
}

export const stripeService = new StripeService();
export default stripeService;