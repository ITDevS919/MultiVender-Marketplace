import { Link } from "wouter";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { AuthForm } from "@/components/auth/AuthForm";
import { ASSETS } from "@/lib/product";

export default function SignupCustomerPage() {
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
            <AuthForm variant="signup" role="customer" />
          </CardContent>
          <CardFooter className="flex flex-col space-y-3">
            <div className="text-sm text-center text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login/customer" className="text-primary hover:underline font-medium">
                Customer login
              </Link>
            </div>
            <div className="text-sm text-center text-muted-foreground">
              Are you a retailer?{" "}
              <Link href="/signup/retailer" className="text-primary hover:underline font-medium">
                Retailer signup
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

