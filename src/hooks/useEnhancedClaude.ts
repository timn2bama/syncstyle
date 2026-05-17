import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { logger } from "@/utils/logger";

interface ClaudeCapabilities {
  visualAnalysis: boolean;
  contextualMemory: boolean;
  personalizedResponses: boolean;
  multiLanguageSupport: boolean;
}

interface AnalysisRequest {
  type: 'visual' | 'text' | 'outfit_advice';
  data: string | File;
  context?: any;
  language?: string;
}

interface AnalysisResponse {
  analysis: string;
  suggestions: string[];
  confidence: number;
  metadata?: any;
}

export const useEnhancedClaude = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [capabilities] = useState<ClaudeCapabilities>({
    visualAnalysis: true,
    contextualMemory: true,
    personalizedResponses: true,
    multiLanguageSupport: true,
  });
  const { toast } = useToast();

  const analyzeContent = useCallback(async (request: AnalysisRequest): Promise<AnalysisResponse | null> => {
    try {
      setIsAnalyzing(true);

      // Convert file to base64 if needed
      let processedData = request.data;
      if (request.data instanceof File) {
        processedData = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(request.data as File);
        });
      }

      const res = await fetch('/api/ai/claude-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: request.type,
          data: processedData,
          context: request.context,
          language: request.language || 'en',
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      return await res.json() as AnalysisResponse;
    } catch (error) {
      logger.error('Enhanced Claude analysis error:', error);
      toast({
        title: 'Analysis failed',
        description: 'Failed to analyze content. Please try again.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [toast]);

  const analyzeOutfitImage = useCallback(async (image: File, context?: any): Promise<AnalysisResponse | null> => {
    return analyzeContent({
      type: 'visual',
      data: image,
      context: { 
        task: 'outfit_analysis',
        ...context 
      },
    });
  }, [analyzeContent]);

  const getPersonalizedAdvice = useCallback(async (
    prompt: string, 
    userPreferences?: any,
    language = 'en'
  ): Promise<AnalysisResponse | null> => {
    return analyzeContent({
      type: 'text',
      data: prompt,
      context: {
        task: 'personalized_advice',
        preferences: userPreferences,
      },
      language,
    });
  }, [analyzeContent]);

  const analyzeClothingItem = useCallback(async (
    image: File,
    existingData?: any
  ): Promise<AnalysisResponse | null> => {
    return analyzeContent({
      type: 'visual',
      data: image,
      context: {
        task: 'clothing_analysis',
        existing: existingData,
      },
    });
  }, [analyzeContent]);

  return {
    capabilities,
    isAnalyzing,
    analyzeContent,
    analyzeOutfitImage,
    getPersonalizedAdvice,
    analyzeClothingItem,
  };
};