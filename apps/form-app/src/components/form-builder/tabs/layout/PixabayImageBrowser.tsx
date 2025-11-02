import React, { useState, useCallback } from 'react';
import { Input, Button, Card } from '@dculus/ui';
import { Search, Download, Eye, Heart, Loader2 } from 'lucide-react';
import { searchPixabayImages, downloadPixabayImage, type PixabayImage } from '../../../../services/pixabayService';
import { useTranslation } from '../../../../hooks/useTranslation';
// Using console.log for now since toast library is not available

interface PixabayImageBrowserProps {
  formId: string;
  onImageApplied: (imageKey: string) => void;
  onUploadSuccess: () => void;
}

export function PixabayImageBrowser({ formId, onImageApplied, onUploadSuccess }: PixabayImageBrowserProps) {
  const { t: tCommon } = useTranslation('common');
  const [searchQuery, setSearchQuery] = useState('');
  const [images, setImages] = useState<PixabayImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<PixabayImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const handleSearch = useCallback(async (query: string, pageNum: number = 1) => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const response = await searchPixabayImages(query, pageNum, 20);
      if (pageNum === 1) {
        setImages(response.hits);
      } else {
        setImages(prev => [...prev, ...response.hits]);
      }
      setHasMore(response.hits.length === 20);
      setPage(pageNum);
    } catch (error) {
      console.error('Pixabay search error:', error);
      console.error('Failed to search images:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(searchQuery, 1);
  };

  const handleLoadMore = () => {
    handleSearch(searchQuery, page + 1);
  };

  const handleApplyImage = async () => {
    if (!selectedImage) return;
    
    setUploading(true);
    try {
      const uploadResult = await downloadPixabayImage(selectedImage.largeImageURL, formId);
      console.log('Image uploaded successfully');
      
      // Apply the image immediately using the returned key
      onImageApplied(uploadResult.key);
      
      // Refresh the form files list
      onUploadSuccess();
      setSelectedImage(null);
    } catch (error) {
      console.error('Upload error:', error);
      console.error('Failed to upload image:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search for background images..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button type="submit" disabled={loading || !searchQuery.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
        </Button>
      </form>

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
          {images.map((image) => (
            <Card
              key={image.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedImage?.id === image.id ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setSelectedImage(image)}
            >
              <div className="aspect-video relative overflow-hidden rounded-lg">
                <img
                  src={image.webformatURL}
                  alt={image.tags}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="text-white text-xs space-y-1 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Eye className="h-3 w-3" />
                      <span>{image.views.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <Download className="h-3 w-3" />
                      <span>{image.downloads.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <Heart className="h-3 w-3" />
                      <span>{image.likes.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-2">
                <p className="text-xs text-gray-600 truncate">{image.tags}</p>
                <p className="text-xs text-gray-500">by {image.user}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <Button 
          variant="outline" 
          onClick={handleLoadMore}
          className="w-full"
        >
          Load More
        </Button>
      )}

      {selectedImage && (
        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Selected Image</p>
              <p className="text-xs text-gray-500">{selectedImage.tags}</p>
            </div>
            <Button 
              onClick={handleApplyImage}
              disabled={uploading}
              size="sm"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {tCommon('uploading')}
                </>
              ) : (
                tCommon('apply')
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}