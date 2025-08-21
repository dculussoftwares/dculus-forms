import React, { useState, useCallback } from 'react';
import { Input, Button, Card } from '@dculus/ui';
import { Search, Download, Eye, Heart, Loader2, X } from 'lucide-react';
import { searchPixabayImages, downloadPixabayImage, type PixabayImage } from '../../../../services/pixabayService';

interface PixabayModalProps {
  isOpen: boolean;
  onClose: () => void;
  formId: string;
  onImageApplied: (imageKey: string) => void;
  onUploadSuccess: () => void;
}

export function PixabayModal({ isOpen, onClose, formId, onImageApplied, onUploadSuccess }: PixabayModalProps) {
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

  const handleApplyImage = async (image: PixabayImage) => {
    setSelectedImage(image);
    setUploading(true);
    try {
      const uploadResult = await downloadPixabayImage(image.largeImageURL, formId);
      console.log('Image uploaded successfully');
      
      // Apply the image immediately using the returned key
      onImageApplied(uploadResult.key);
      
      // Refresh the form files list
      onUploadSuccess();
      setSelectedImage(null);
      onClose();
    } catch (error) {
      console.error('Upload error:', error);
      console.error('Failed to upload image:', error);
      setSelectedImage(null);
    } finally {
      setUploading(false);
    }
  };

  const resetModal = () => {
    setSearchQuery('');
    setImages([]);
    setSelectedImage(null);
    setLoading(false);
    setUploading(false);
    setPage(1);
    setHasMore(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] m-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Browse Background Images
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Search and select images from Pixabay
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
            className="p-2"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col p-6">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-4">
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

          {/* Images Grid */}
          <div className="flex-1 overflow-y-auto">
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-4 mb-4">
                {images.map((image) => (
                  <Card
                    key={image.id}
                    className={`group transition-all hover:shadow-lg relative overflow-hidden ${
                      uploading && selectedImage?.id === image.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                  >
                    <div className="aspect-video relative overflow-hidden rounded-lg">
                      <img
                        src={image.webformatURL}
                        alt={image.tags}
                        className="w-full h-full object-cover"
                      />
                      
                      {/* Overlay with stats - always visible on hover */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute top-2 right-2 text-white text-xs space-y-1">
                          <div className="flex items-center gap-1 bg-black/50 rounded px-1">
                            <Eye className="h-3 w-3" />
                            <span>{image.views.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-1 bg-black/50 rounded px-1">
                            <Download className="h-3 w-3" />
                            <span>{image.downloads.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-1 bg-black/50 rounded px-1">
                            <Heart className="h-3 w-3" />
                            <span>{image.likes.toLocaleString()}</span>
                          </div>
                        </div>
                        
                        {/* Apply button in center */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Button
                            onClick={() => handleApplyImage(image)}
                            disabled={uploading}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
                          >
                            {uploading && selectedImage?.id === image.id ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Applying...
                              </>
                            ) : (
                              'Apply Background'
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-3">
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate font-medium">{image.tags}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">by {image.user}</p>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {hasMore && !loading && (
              <div className="text-center">
                <Button 
                  variant="outline" 
                  onClick={handleLoadMore}
                >
                  Load More
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}