import React, { useState, useCallback } from 'react';
import { useTranslation } from '../../../../hooks/useTranslation';
import { Input, Button, Card, toastError, toastSuccess } from '@dculus/ui';
import { Search, Download, Eye, Heart, Loader2, X, Play } from 'lucide-react';
import { cn } from '@dculus/utils';
import {
  searchPixabayImages,
  downloadPixabayImage,
  searchPixabayVideos,
  downloadPixabayVideo,
  type PixabayImage,
  type PixabayVideo,
} from '../../../../services/pixabayService';
import { UploadError } from '../../../../services/fileUploadService';

interface PixabayModalProps {
  isOpen: boolean;
  onClose: () => void;
  formId: string;
  onImageApplied: (imageKey: string) => void;
  onVideoApplied: (videoKey: string) => void;
  onUploadSuccess: () => void;
}

type MediaType = 'photo' | 'video';

export function PixabayModal({ isOpen, onClose, formId, onImageApplied, onVideoApplied, onUploadSuccess }: PixabayModalProps) {
  const { t } = useTranslation('pixabayImageBrowser');
  const [mediaType, setMediaType] = useState<MediaType>('photo');
  const [searchQuery, setSearchQuery] = useState('');
  const [images, setImages] = useState<PixabayImage[]>([]);
  const [videos, setVideos] = useState<PixabayVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<PixabayImage | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<PixabayVideo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const handleSearch = useCallback(async (query: string, pageNum: number = 1, type: MediaType = mediaType) => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      if (type === 'photo') {
        const response = await searchPixabayImages(query, pageNum, 20);
        setImages(prev => (pageNum === 1 ? response.hits : [...prev, ...response.hits]));
        setHasMore(response.hits.length === 20);
      } else {
        const response = await searchPixabayVideos(query, pageNum, 20);
        setVideos(prev => (pageNum === 1 ? response.hits : [...prev, ...response.hits]));
        setHasMore(response.hits.length === 20);
      }
      setPage(pageNum);
    } catch {
      if (type === 'photo') {
        toastError(t('searchFailedTitle'), t('imageSearchFailed'));
      } else {
        toastError(t('searchFailedTitle'), t('videoSearchFailed'));
      }
    } finally {
      setLoading(false);
    }
  }, [mediaType, t]);

  const handleMediaTypeChange = (type: MediaType) => {
    setMediaType(type);
    setImages([]);
    setVideos([]);
    setHasMore(false);
    setPage(1);
    if (searchQuery.trim()) {
      handleSearch(searchQuery, 1, type);
    }
  };

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
      const uploadResult = await downloadPixabayImage(image.fullHDURL ?? image.largeImageURL, formId);
      toastSuccess(t('imageAppliedSuccess'));
      onImageApplied(uploadResult.key);
      onUploadSuccess();
      setSelectedImage(null);
      onClose();
    } catch (error) {
      if (error instanceof UploadError && error.code === 'FILE_TOO_LARGE') {
        toastError(t('imageTooLargeTitle'), t('imageTooLargeDescription'));
      } else {
        toastError(t('uploadFailedTitle'), t('imageApplyFailed'));
      }
      setSelectedImage(null);
    } finally {
      setUploading(false);
    }
  };

  const handleApplyVideo = async (video: PixabayVideo) => {
    setSelectedVideo(video);
    setUploading(true);
    try {
      const uploadResult = await downloadPixabayVideo(video, formId);
      toastSuccess(t('videoAppliedSuccess'));
      onVideoApplied(uploadResult.key);
      onUploadSuccess();
      setSelectedVideo(null);
      onClose();
    } catch (error) {
      if (error instanceof UploadError && error.code === 'FILE_TOO_LARGE') {
        toastError(t('videoTooLargeTitle'), t('videoTooLargeDescription'));
      } else {
        toastError(t('uploadFailedTitle'), t('videoApplyFailed'));
      }
      setSelectedVideo(null);
    } finally {
      setUploading(false);
    }
  };

  const resetModal = () => {
    setMediaType('photo');
    setSearchQuery('');
    setImages([]);
    setVideos([]);
    setSelectedImage(null);
    setSelectedVideo(null);
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
        <div className="flex items-center justify-between p-6 border-b border-[var(--tf-border-medium)] dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-primary dark:text-white">
              {t('title')}
            </h2>
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              {t('subtitle')}
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
          {/* Media type toggle */}
          <div className="flex gap-2 mb-4">
            <Button
              type="button"
              size="sm"
              variant={mediaType === 'photo' ? 'default' : 'outline'}
              onClick={() => handleMediaTypeChange('photo')}
            >
              {t('mediaType.photos')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mediaType === 'video' ? 'default' : 'outline'}
              onClick={() => handleMediaTypeChange('video')}
            >
              {t('mediaType.videos')}
            </Button>
          </div>

          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={mediaType === 'photo' ? t('searchPlaceholder') : t('videoSearchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit" disabled={loading || !searchQuery.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('searchButton')}
            </Button>
          </form>

          {/* Images Grid */}
          <div className="flex-1 overflow-y-auto">
            {mediaType === 'photo' && images.length > 0 && (
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
                                {t('applyingButton')}
                              </>
                            ) : (
                              t('applyBackgroundButton')
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-3">
                      <p className="text-xs text-foreground dark:text-gray-400 truncate font-medium">{image.tags}</p>
                      <p className="text-xs text-muted-foreground dark:text-gray-500">{t('byAuthor', { values: { author: image.user } })}</p>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {mediaType === 'video' && videos.length > 0 && (
              <div className="grid grid-cols-3 gap-4 mb-4">
                {videos.map((video) => (
                  <Card
                    key={video.id}
                    className={cn(
                      'group transition-all hover:shadow-lg relative overflow-hidden',
                      uploading && selectedVideo?.id === video.id ? 'ring-2 ring-blue-500' : ''
                    )}
                  >
                    <div className="aspect-video relative overflow-hidden rounded-lg">
                      <img
                        src={video.videos.tiny.thumbnail}
                        alt={video.tags}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <Play className="h-8 w-8 text-white/90" />
                      </div>

                      {/* Overlay with stats - always visible on hover */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute top-2 right-2 text-white text-xs space-y-1">
                          <div className="flex items-center gap-1 bg-black/50 rounded px-1">
                            <Eye className="h-3 w-3" />
                            <span>{video.views.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-1 bg-black/50 rounded px-1">
                            <Download className="h-3 w-3" />
                            <span>{video.downloads.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-1 bg-black/50 rounded px-1">
                            <Heart className="h-3 w-3" />
                            <span>{video.likes.toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="absolute inset-0 flex items-center justify-center">
                          <Button
                            onClick={() => handleApplyVideo(video)}
                            disabled={uploading}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
                          >
                            {uploading && selectedVideo?.id === video.id ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                {t('applyingButton')}
                              </>
                            ) : (
                              t('applyVideoBackgroundButton')
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="p-3">
                      <p className="text-xs text-foreground dark:text-gray-400 truncate font-medium">{video.tags}</p>
                      <p className="text-xs text-muted-foreground dark:text-gray-500">{t('byAuthor', { values: { author: video.user } })}</p>
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
                  {t('loadMoreButton')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}