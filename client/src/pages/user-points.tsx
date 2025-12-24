import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Coins, TrendingUp, Gift, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { useRequireRole } from "@/hooks/useRequireRole";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

interface UserPoints {
  balance: number;
  totalEarned: number;
  totalRedeemed: number;
}

interface PointsTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  description?: string;
  created_at: string;
  order_id?: string;
}

export default function UserPointsPage() {
  useRequireRole("customer", "/login/customer");
  const { user } = useAuth();
  const [points, setPoints] = useState<UserPoints | null>(null);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pointsRes, transactionsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/user/points`, { credentials: "include" }),
        fetch(`${API_BASE_URL}/user/points/transactions`, { credentials: "include" }),
      ]);

      const pointsData = await pointsRes.json();
      const transactionsData = await transactionsRes.json();

      if (pointsRes.ok && pointsData.success) {
        setPoints(pointsData.data);
      }

      if (transactionsRes.ok && transactionsData.success) {
        setTransactions(transactionsData.data);
      }
    } catch (err) {
      console.error("Failed to fetch points data:", err);
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "earned":
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case "redeemed":
        return <Gift className="h-4 w-4 text-blue-600" />;
      default:
        return <Coins className="h-4 w-4" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "earned":
        return "text-green-600";
      case "redeemed":
        return "text-blue-600";
      default:
        return "text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-10">
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">My Points</h1>
          <p className="text-muted-foreground">View your cashback points and transaction history</p>
        </div>

        {/* Points Summary */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">£{points?.balance.toFixed(2) || "0.00"}</div>
              <p className="text-xs text-muted-foreground">Ready to redeem</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">£{points?.totalEarned.toFixed(2) || "0.00"}</div>
              <p className="text-xs text-muted-foreground">All time earnings</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Redeemed</CardTitle>
              <Gift className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">£{points?.totalRedeemed.toFixed(2) || "0.00"}</div>
              <p className="text-xs text-muted-foreground">Points used</p>
            </CardContent>
          </Card>
        </div>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>View all your points transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Coins className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No transactions yet</p>
                <p className="text-sm mt-2">Start shopping to earn cashback points!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getTransactionIcon(transaction.transaction_type)}
                      <div>
                        <p className="font-medium capitalize">{transaction.transaction_type}</p>
                        <p className="text-sm text-muted-foreground">
                          {transaction.description || "Points transaction"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(transaction.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className={`font-semibold ${getTransactionColor(transaction.transaction_type)}`}>
                      {transaction.transaction_type === "earned" ? "+" : "-"}£
                      {Number(transaction.amount).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
