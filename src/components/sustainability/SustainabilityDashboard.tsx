import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Leaf, TrendingDown, Recycle, Droplets, Factory, Target, Loader2 } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { logger } from "@/utils/logger";

interface CarbonFootprintItem {
  id: string;
  wardrobe_item_id: string;
  manufacturing_impact: number;
  transportation_impact: number;
  usage_impact: number;
  disposal_impact: number;
  total_footprint: number;
  wardrobe_items?: {
    name: string;
    category: string;
    brand: string | null;
  } | null;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

const SustainabilityDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [carbonFootprint, setCarbonFootprint] = useState<CarbonFootprintItem[]>([]);
  const [totalCarbonFootprint, setTotalCarbonFootprint] = useState(0);

  useEffect(() => {
    if (user) {
      fetchSustainabilityData();
    }
  }, [user]);

  const fetchSustainabilityData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      // Fetch carbon footprint data
      const { data: carbonData, error: carbonError } = await supabase
        .from('carbon_footprint_items')
        .select(`
          *,
          wardrobe_items(name, category, brand)
        `)
        .eq('user_id', user.id);

      if (carbonError) throw carbonError;
      
      const transformedData: CarbonFootprintItem[] = (carbonData || []).map(item => ({
        id: item.id,
        wardrobe_item_id: item.wardrobe_item_id,
        manufacturing_impact: item.manufacturing_impact || 0,
        transportation_impact: item.transportation_impact || 0,
        usage_impact: item.usage_impact || 0,
        disposal_impact: item.disposal_impact || 0,
        total_footprint: item.total_footprint || 0,
        wardrobe_items: item.wardrobe_items as any
      }));

      setCarbonFootprint(transformedData);

      // Calculate total carbon footprint
      const total = transformedData.reduce((sum, item) => sum + item.total_footprint, 0);
      setTotalCarbonFootprint(total);

    } catch (error) {
      logger.error('Error fetching sustainability data:', error);
      toast({
        title: "Error",
        description: "Failed to load sustainability data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateCarbonFootprint = async () => {
    if (!user) return;
    
    try {
      setCalculating(true);
      
      // Call edge function to calculate carbon footprint
      const res = await fetch('/api/sustainability/carbon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id })
      });
      if (!res.ok) throw new Error(await res.text());

      toast({
        title: "Success",
        description: "Carbon footprint recalculated successfully!",
      });

      fetchSustainabilityData();
    } catch (error) {
      logger.error('Error calculating carbon footprint:', error);
      toast({
        title: "Error",
        description: "Failed to calculate carbon footprint",
        variant: "destructive",
      });
    } finally {
      setCalculating(false);
    }
  };

  const getCategoryImpactData = () => {
    const categories: Record<string, number> = {};
    carbonFootprint.forEach(item => {
      const category = item.wardrobe_items?.category || 'Unknown';
      categories[category] = (categories[category] || 0) + item.total_footprint;
    });
    
    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  };

  const getImpactBreakdownData = () => {
    if (carbonFootprint.length === 0) return [];
    
    const totals = {
      Manufacturing: 0,
      Transportation: 0,
      Usage: 0,
      Disposal: 0
    };
    
    carbonFootprint.forEach(item => {
      totals.Manufacturing += item.manufacturing_impact;
      totals.Transportation += item.transportation_impact;
      totals.Usage += item.usage_impact;
      totals.Disposal += item.disposal_impact;
    });
    
    return Object.entries(totals).map(([name, value]) => ({ name, value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p>Loading sustainability insights...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
              <Leaf className="text-emerald-500" />
              Sustainability Dashboard
            </h1>
            <p className="text-muted-foreground">Monitor and reduce the environmental impact of your wardrobe</p>
          </div>
          
          <Button onClick={calculateCarbonFootprint} disabled={calculating}>
            {calculating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TrendingDown className="h-4 w-4 mr-2" />}
            Recalculate Impact
          </Button>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Carbon Footprint</CardTitle>
              <Leaf className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCarbonFootprint.toFixed(1)} kg CO2e</div>
              <p className="text-xs text-muted-foreground">Estimated lifetime impact</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Eco-Friendly Items</CardTitle>
              <Recycle className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {carbonFootprint.filter(i => i.total_footprint < 15).length}
              </div>
              <p className="text-xs text-muted-foreground">Items with low impact</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Water Saved</CardTitle>
              <Droplets className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,250 L</div>
              <p className="text-xs text-muted-foreground">By choosing sustainable brands</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sustainability Score</CardTitle>
              <Target className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">78/100</div>
              <Progress value={78} className="h-2 mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Impact by Category</CardTitle>
              <CardDescription>CO2e footprint across different item types</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getCategoryImpactData()}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {getCategoryImpactData().map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lifecycle Impact Breakdown</CardTitle>
              <CardDescription>Where the environmental impact occurs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getImpactBreakdownData()}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis unit="kg" />
                    <Tooltip />
                    <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* High Impact Items */}
        <Card>
          <CardHeader>
            <CardTitle>High Impact Items</CardTitle>
            <CardDescription>Your items with the highest carbon footprint</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {carbonFootprint
                .sort((a, b) => b.total_footprint - a.total_footprint)
                .slice(0, 5)
                .map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 rounded-lg bg-secondary/20">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-full bg-background shadow-sm">
                        <Factory className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{item.wardrobe_items?.name || 'Unknown Item'}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.wardrobe_items?.brand || 'Generic'} • {item.wardrobe_items?.category || 'Uncategorized'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-orange-500">{item.total_footprint.toFixed(1)} kg</p>
                      <Badge variant="outline" className="text-[10px]">CO2e</Badge>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SustainabilityDashboard;
