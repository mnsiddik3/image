import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Upload, Sparkles, Copy, Download, Settings, Image as ImageIcon } from 'lucide-react';

interface MetadataResult {
  title: string;
  description: string;
  keywords: string[];
  altText: string;
  category: string;
}

const MetadataGenerator = () => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>(localStorage.getItem('gemini-api-key') || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [metadata, setMetadata] = useState<MetadataResult | null>(null);
  const [showApiKeyInput, setShowApiKeyInput] = useState(!apiKey);
  const { toast } = useToast();

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image under 10MB",
          variant: "destructive"
        });
        return;
      }

      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, [toast]);

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

  const generateMetadata = async () => {
    if (!selectedImage || !apiKey) {
      toast({
        title: "Missing Requirements",
        description: "Please select an image and provide API key",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.onload = async () => {
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
                  text: `Analyze this stock image and generate comprehensive metadata. Provide a JSON response with:
                  - title: A catchy, SEO-friendly title (max 60 characters)
                  - description: Detailed description for stock photo sites (max 150 characters)
                  - keywords: Array of 15-20 relevant keywords/tags
                  - altText: Accessible alt text description
                  - category: Main category (e.g., Business, Nature, Technology, etc.)
                  
                  Focus on commercial use, marketability, and searchability. Make it compelling for buyers.`
                },
                {
                  inlineData: {
                    mimeType: selectedImage.type,
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
          setMetadata(result);
          toast({
            title: "Metadata Generated!",
            description: "AI has analyzed your image and created metadata"
          });
        } else {
          throw new Error('Invalid response format');
        }
      };
      
      reader.readAsDataURL(selectedImage);
      
    } catch (error) {
      console.error('Error generating metadata:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate metadata. Check your API key.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Text copied to clipboard"
    });
  };

  const downloadMetadata = () => {
    if (!metadata) return;
    
    const content = `Title: ${metadata.title}

Description: ${metadata.description}

Keywords: ${metadata.keywords.join(', ')}

Alt Text: ${metadata.altText}

Category: ${metadata.category}`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${metadata.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_metadata.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-bg p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-4">
            Stock Image Metadata Generator
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            AI-powered tool to generate SEO-optimized titles, descriptions, and keywords for your stock images
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <Card className="border-border bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Image
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* API Key Section */}
              {showApiKeyInput && (
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
              )}

              {apiKey && !showApiKeyInput && (
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
              )}

              {/* Image Upload */}
              <div className="space-y-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                >
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-w-full max-h-full object-contain rounded-lg"
                    />
                  ) : (
                    <div className="flex flex-col items-center">
                      <ImageIcon className="w-12 h-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground text-center">
                        Click to upload image<br />
                        <span className="text-sm">JPG, PNG, WEBP (max 10MB)</span>
                      </p>
                    </div>
                  )}
                </label>

                <Button
                  onClick={generateMetadata}
                  disabled={!selectedImage || !apiKey || isGenerating}
                  className="w-full"
                  size="lg"
                >
                  {isGenerating ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Analyzing Image...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      Generate Metadata
                    </div>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results Section */}
          <Card className="border-border bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Generated Metadata</span>
                {metadata && (
                  <Button onClick={downloadMetadata} variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metadata ? (
                <div className="space-y-6 animate-fade-in">
                  {/* Title */}
                  <div className="space-y-2">
                    <Label className="font-semibold">Title</Label>
                    <div className="flex gap-2">
                      <Textarea
                        value={metadata.title}
                        readOnly
                        className="flex-1 min-h-[60px]"
                      />
                      <Button
                        onClick={() => copyToClipboard(metadata.title)}
                        variant="outline"
                        size="sm"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label className="font-semibold">Description</Label>
                    <div className="flex gap-2">
                      <Textarea
                        value={metadata.description}
                        readOnly
                        className="flex-1 min-h-[80px]"
                      />
                      <Button
                        onClick={() => copyToClipboard(metadata.description)}
                        variant="outline"
                        size="sm"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Keywords */}
                  <div className="space-y-2">
                    <Label className="font-semibold">Keywords ({metadata.keywords.length})</Label>
                    <div className="flex flex-wrap gap-2 p-4 border border-border rounded-lg bg-accent/20">
                      {metadata.keywords.map((keyword, index) => (
                        <Badge key={index} variant="secondary">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                    <Button
                      onClick={() => copyToClipboard(metadata.keywords.join(', '))}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy All Keywords
                    </Button>
                  </div>

                  {/* Alt Text */}
                  <div className="space-y-2">
                    <Label className="font-semibold">Alt Text</Label>
                    <div className="flex gap-2">
                      <Textarea
                        value={metadata.altText}
                        readOnly
                        className="flex-1 min-h-[60px]"
                      />
                      <Button
                        onClick={() => copyToClipboard(metadata.altText)}
                        variant="outline"
                        size="sm"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Category */}
                  <div className="space-y-2">
                    <Label className="font-semibold">Category</Label>
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="text-lg py-2 px-4">
                        {metadata.category}
                      </Badge>
                      <Button
                        onClick={() => copyToClipboard(metadata.category)}
                        variant="outline"
                        size="sm"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Upload an image and click "Generate Metadata" to see AI-powered results</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MetadataGenerator;