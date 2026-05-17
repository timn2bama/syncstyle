import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Check, X, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { logger } from "@/utils/logger";

interface SubscriptionStatus {
  subscribed: boolean;
  subscription_tier?: string;
  subscription_end?: string;
}

export default function Subscription() {
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({ subscribed: false });
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const checkSubscriptionStatus = async () => {
    if (!user) return;
    
    setCheckingStatus(true);
    try {
      const res = await fetch('/api/subscriptions/check');
      if (!res.ok) throw new Error(await res.text());
      setSubscriptionStatus(await res.json());
    } catch (error) {
      logger.error('Error checking subscription:', error);
      // Set default state instead of showing repeated error toasts
      setSubscriptionStatus({ subscribed: false });
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleSubscribe = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/subscriptions/checkout', { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      window.open(data.url, '_blank');
    } catch (error) {
      logger.error('Error creating checkout:', error);
      toast({
        title: "Error",
        description: "Failed to create checkout session",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/subscriptions/portal', { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      window.open(data.url, '_blank');
    } catch (error) {
      logger.error('Error opening customer portal:', error);
      toast({
        title: "Error",
        description: "Failed to open customer portal",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    checkSubscriptionStatus();
  }, [user, navigate]);

  useEffect(() => {
    // Auto-refresh subscription status every 10 seconds
    const interval = setInterval(checkSubscriptionStatus, 10000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    // Check for success/cancel parameters from Stripe redirect
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      toast({
        title: "Success!",
        description: "Your subscription has been activated.",
      });
      checkSubscriptionStatus();
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('canceled') === 'true') {
      toast({
        title: "Canceled",
        description: "Subscription setup was canceled.",
        variant: "destructive",
      });
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Subscription</h1>
        <p className="text-muted-foreground">
          Upgrade to Premium for unlimited wardrobe items and advanced features
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Free Plan */}
        <Card className={!subscriptionStatus.subscribed ? "border-primary" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Free Plan
              {!subscriptionStatus.subscribed && (
                <Badge>Current Plan</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Get started with basic wardrobe management
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-3xl font-bold">
                $0<span className="text-base font-normal text-muted-foreground">/month</span>
              </div>
              
              <Separator />
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">4 items per category</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Basic outfit creation</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Weather integration</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Premium Plan */}
        <Card className={subscriptionStatus.subscribed ? "border-primary" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Premium Plan
              {subscriptionStatus.subscribed && (
                <Badge>Current Plan</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Unlock unlimited uploads and advanced features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-3xl font-bold">
                $6<span className="text-base font-normal text-muted-foreground">/month</span>
              </div>
              
              <Separator />
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Unlimited uploads</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Advanced outfit suggestions</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Weather-based recommendations</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Priority customer support</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Export wardrobe data</span>
                </div>
              </div>
            </div>
          </CardContent>
          {!subscriptionStatus.subscribed && (
            <CardFooter>
              <Button 
                onClick={handleSubscribe} 
                disabled={loading}
                className="w-full"
              >
                {loading ? "Processing..." : "Subscribe Now"}
              </Button>
            </CardFooter>
          )}
        </Card>

        {/* Current Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Status
              <Button
                variant="ghost"
                size="sm"
                onClick={checkSubscriptionStatus}
                disabled={checkingStatus}
              >
                <RefreshCw className={`h-4 w-4 ${checkingStatus ? 'animate-spin' : ''}`} />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Plan:</span>
                <Badge variant={subscriptionStatus.subscribed ? "default" : "secondary"}>
                  {subscriptionStatus.subscribed ? subscriptionStatus.subscription_tier || "Premium" : "Free"}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="font-medium">Status:</span>
                <div className="flex items-center gap-2">
                  {subscriptionStatus.subscribed ? (
                    <>
                      <Check className="h-4 w-4 text-green-500" />
                      <span className="text-green-600">Active</span>
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4 text-gray-500" />
                      <span className="text-muted-foreground">Inactive</span>
                    </>
                  )}
                </div>
              </div>

              {subscriptionStatus.subscribed && subscriptionStatus.subscription_end && (
                <div className="flex items-center justify-between">
                  <span className="font-medium">Next billing:</span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(subscriptionStatus.subscription_end).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
          {subscriptionStatus.subscribed && (
            <CardFooter>
              <Button 
                variant="outline" 
                onClick={handleManageSubscription}
                disabled={loading}
                className="w-full"
              >
                Manage Subscription
              </Button>
            </CardFooter>
          )}
        </Card>

      </div>

    </div>
  );
}