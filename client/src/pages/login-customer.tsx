import { Link } from "wouter";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { AuthForm } from "@/components/auth/AuthForm";
import { ASSETS } from "@/lib/product";

export default function LoginCustomerPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/">
            <img
              src={ASSETS.logo}
              alt="Localito Logo"
              className="h-14 w-auto object-contain cursor-pointer"
            />
          </Link>
        </div>

        <Card>
          <CardHeader />
          <CardContent>
            <AuthForm variant="login" role="customer" />
          </CardContent>
          <CardFooter className="flex flex-col space-y-3">
            <div className="text-sm text-center text-muted-foreground">
              New to Localito?{" "}
              <Link href="/signup/customer" className="text-primary hover:underline font-medium">
                Create a customer account
              </Link>
            </div>
            <div className="text-sm text-center text-muted-foreground">
              Are you a retailer?{" "}
              <Link href="/login/retailer" className="text-primary hover:underline font-medium">
                Retailer login
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

