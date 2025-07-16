import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Upload, Sparkles, Copy, Download, Settings, Image as ImageIcon, X, FileImage, Play, Pause } from 'lucide-react';

interface MetadataResult {
  title: string;
  description: string;
  keywords: string[];
  topTenKeywords: string[];
  altText: string;
  category: string;
}

interface ImageBatch {
  file: File;
  preview: string;
  metadata: MetadataResult | null;
  isProcessing: boolean;
  id: string;
}

const MetadataGenerator = () => {
  const [imageBatch, setImageBatch] = useState<ImageBatch[]>([]);
  const [apiKey, setApiKey] = useState<string>(localStorage.getItem('gemini-api-key') || '');
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(!apiKey);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState(-1);
  const { toast } = useToast();

  const handleBatchImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    if (files.length === 0) return;
    if (files.length > 50) {
      toast({
        title: "Too many files",
        description: "Please select maximum 50 images",
        variant: "destructive"
      });
      return;
    }

    if (imageBatch.length + files.length > 50) {
      toast({
        title: "Batch limit exceeded",
        description: `You can only process up to 50 images at once. Currently you have ${imageBatch.length} images.`,
        variant: "destructive"
      });
      return;
    }

    const newImages: ImageBatch[] = [];

    files.forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} is over 10MB and was skipped`,
          variant: "destructive"
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const newImage: ImageBatch = {
          file,
          preview: e.target?.result as string,
          metadata: null,
          isProcessing: false,
          id: Math.random().toString(36).substr(2, 9)
        };
        
        setImageBatch(prev => [...prev, newImage]);
      };
      reader.readAsDataURL(file);
    });
  }, [toast, imageBatch.length]);

  const removeImage = (id: string) => {
    setImageBatch(prev => prev.filter(img => img.id !== id));
  };

  const saveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('gemini-api-key', apiKey.trim());
      setShowApiKeyInput(false);
      toast({
        title: "API Key Saved",
        description: "Your Gemini API key has been saved locally"
      });
    }
  };

  const generateSingleMetadata = async (imageFile: File): Promise<MetadataResult> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Image = (reader.result as string).split(',')[1];
          
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{
                parts: [
                  {
                    text: `Analyze this stock image and generate comprehensive metadata optimized for iStock, Adobe Stock, Shutterstock, and Freepik. Provide a JSON response with:
                    - title: A catchy, SEO-friendly title (max 60 characters)
                    - description: Detailed description for stock photo sites (max 150 characters)
                    - keywords: Array of 20-25 relevant keywords/tags for general search
                    - topTenKeywords: Array of exactly 10 most important keywords prioritized for stock photo sites (iStock, Adobe Stock, Shutterstock, Freepik)
                    - altText: Accessible alt text description
                    - category: Main category (e.g., Business, Nature, Technology, People, Abstract, etc.)
                    
                    Focus on commercial use, marketability, and searchability. Make keywords highly relevant for stock photo buyers. The topTenKeywords should be the most searchable and commercial terms that buyers would use on these platforms.`
                  },
                  {
                    inlineData: {
                      mimeType: imageFile.type,
                      data: base64Image
                    }
                  }
                ]
              }]
            })
          });

          if (!response.ok) {
            throw new Error('Failed to generate metadata');
          }

          const data = await response.json();
          const text = data.candidates[0].content.parts[0].text;
          
          // Extract JSON from response
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            
            // Ensure topTenKeywords exists and has exactly 10 items
            if (!result.topTenKeywords || result.topTenKeywords.length !== 10) {
              result.topTenKeywords = result.keywords.slice(0, 10);
            }
            
            resolve(result);
          } else {
            throw new Error('Invalid response format');
          }
        } catch (error) {
          reject(error);
        }
      };
      
      reader.readAsDataURL(imageFile);
    });
  };

  const processBatch = async () => {
    if (imageBatch.length === 0 || !apiKey) {
      toast({
        title: "Missing Requirements",
        description: "Please add images and provide API key",
        variant: "destructive"
      });
      return;
    }

    setIsBatchProcessing(true);
    setCurrentProcessingIndex(0);

    for (let i = 0; i < imageBatch.length; i++) {
      const image = imageBatch[i];
      setCurrentProcessingIndex(i);
      
      // Update processing status
      setImageBatch(prev => prev.map(img => 
        img.id === image.id 
          ? { ...img, isProcessing: true }
          : img
      ));

      try {
        const metadata = await generateSingleMetadata(image.file);
        
        // Update with generated metadata
        setImageBatch(prev => prev.map(img => 
          img.id === image.id 
            ? { ...img, metadata, isProcessing: false }
            : img
        ));

        // Small delay to prevent API rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error processing ${image.file.name}:`, error);
        
        // Update with error status
        setImageBatch(prev => prev.map(img => 
          img.id === image.id 
            ? { ...img, isProcessing: false }
            : img
        ));

        toast({
          title: "Processing Error",
          description: `Failed to process ${image.file.name}`,
          variant: "destructive"
        });
      }
    }

    setIsBatchProcessing(false);
    setCurrentProcessingIndex(-1);
    
    toast({
      title: "Batch Processing Complete!",
      description: `Processed ${imageBatch.length} images`
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Text copied to clipboard"
    });
  };

  const downloadBatchMetadata = () => {
    const processedImages = imageBatch.filter(img => img.metadata);
    if (processedImages.length === 0) return;
    
    let content = '';
    processedImages.forEach((image, index) => {
      const metadata = image.metadata!;
      content += `=== Image ${index + 1}: ${image.file.name} ===\n\n`;
      content += `Title: ${metadata.title}\n\n`;
      content += `Description: ${metadata.description}\n\n`;
      content += `Top 10 Keywords: ${metadata.topTenKeywords.join(', ')}\n\n`;
      content += `All Keywords: ${metadata.keywords.join(', ')}\n\n`;
      content += `Alt Text: ${metadata.altText}\n\n`;
      content += `Category: ${metadata.category}\n\n`;
      content += '---\n\n';
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch_metadata_${processedImages.length}_images.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearBatch = () => {
    setImageBatch([]);
    setCurrentProcessingIndex(-1);
  };

  return (
    <div className="min-h-screen bg-gradient-bg p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-4">
            Stock Image Metadata Generator
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            AI-powered batch tool to generate SEO-optimized metadata for 1-50 stock images at once
          </p>
        </div>

        {/* API Key Section */}
        {showApiKeyInput && (
          <Card className="mb-6 border-border bg-card/50 backdrop-blur">
            <CardContent className="pt-6">
              <div className="space-y-3 p-4 border border-border rounded-lg bg-accent/20">
                <Label htmlFor="api-key" className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Google Gemini API Key
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="Enter your Gemini API key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={saveApiKey} variant="secondary">
                    Save
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Get your free API key from Google AI Studio
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {apiKey && !showApiKeyInput && (
          <Card className="mb-6 border-border bg-card/50 backdrop-blur">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                <span className="text-sm text-primary">API Key configured ✓</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowApiKeyInput(true)}
                >
                  Change
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Upload Section */}
          <Card className="border-border bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Images (1-50)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleBatchImageUpload}
                className="hidden"
                id="batch-upload"
              />
              <label
                htmlFor="batch-upload"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
              >
                <div className="flex flex-col items-center">
                  <FileImage className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-center text-sm">
                    Click to add images<br />
                    <span className="text-xs">JPG, PNG, WEBP (max 10MB each)</span>
                  </p>
                </div>
              </label>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {imageBatch.length}/50 images
                </span>
                {imageBatch.length > 0 && (
                  <Button onClick={clearBatch} variant="outline" size="sm">
                    <X className="w-4 h-4 mr-2" />
                    Clear All
                  </Button>
                )}
              </div>

              <Button
                onClick={processBatch}
                disabled={imageBatch.length === 0 || !apiKey || isBatchProcessing}
                className="w-full"
                size="lg"
              >
                {isBatchProcessing ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Processing {currentProcessingIndex + 1}/{imageBatch.length}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Generate All Metadata
                  </div>
                )}
              </Button>

              {imageBatch.filter(img => img.metadata).length > 0 && (
                <Button
                  onClick={downloadBatchMetadata}
                  variant="outline"
                  className="w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download All Results
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Image Grid */}
          <div className="lg:col-span-2">
            <Card className="border-border bg-card/50 backdrop-blur">
              <CardHeader>
                <CardTitle>Image Batch</CardTitle>
              </CardHeader>
              <CardContent>
                {imageBatch.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No images uploaded yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                    {imageBatch.map((image) => (
                      <div key={image.id} className="border border-border rounded-lg p-3 space-y-3">
                        <div className="relative">
                          <img
                            src={image.preview}
                            alt={image.file.name}
                            className="w-full h-24 object-cover rounded"
                          />
                          <Button
                            onClick={() => removeImage(image.id)}
                            variant="destructive"
                            size="sm"
                            className="absolute top-1 right-1 w-6 h-6 p-0"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                          {image.isProcessing && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded">
                              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <p className="text-xs font-medium truncate">{image.file.name}</p>
                          
                          {image.metadata && (
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground">
                                <strong>Top 10 Keywords:</strong>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {image.metadata.topTenKeywords.map((keyword, idx) => (
                                  <Badge key={idx} variant="default" className="text-xs">
                                    {keyword}
                                  </Badge>
                                ))}
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  onClick={() => copyToClipboard(image.metadata!.topTenKeywords.join(', '))}
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-6"
                                >
                                  <Copy className="w-3 h-3 mr-1" />
                                  Copy Top 10
                                </Button>
                                <Button
                                  onClick={() => copyToClipboard(image.metadata!.keywords.join(', '))}
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-6"
                                >
                                  <Copy className="w-3 h-3 mr-1" />
                                  Copy All
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetadataGenerator;