import React, { useState, useCallback } from 'react';
import { useTranslation } from '../../../../hooks/useTranslation';
import { Input, Button, Card, toastError, toastSuccess } from '@dculus/ui';
import { Search, Loader2, X, Play } from 'lucide-react';
import { cn } from '@dculus/utils';
import {
  searchPexelsImages,
  downloadPexelsImage,
  searchPexelsVideos,
  downloadPexelsVideo,
  type PexelsPhoto,
  type PexelsVideo,
} from '../../../../services/pexelsService';
import { UploadError } from '../../../../services/fileUploadService';

interface PexelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  formId: string;
  onImageApplied: (imageKey: string, dominantColor: string) => void;
  onVideoApplied: (videoKey: string, dominantColor: string) => void;
  onUploadSuccess: () => void;
}

type MediaType = 'photo' | 'video';

export function PexelsModal({ isOpen, onClose, formId, onImageApplied, onVideoApplied, onUploadSuccess }: PexelsModalProps) {
  const { t } = useTranslation('pexelsImageBrowser');
  const [mediaType, setMediaType] = useState<MediaType>('photo');
  const [searchQuery, setSearchQuery] = useState('');
  const [images, setImages] = useState<PexelsPhoto[]>([]);
  const [videos, setVideos] = useState<PexelsVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<PexelsPhoto | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<PexelsVideo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const handleSearch = useCallback(async (query: string, pageNum: number = 1, type: MediaType = mediaType) => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      if (type === 'photo') {
        const response = await searchPexelsImages(query, pageNum, 15);
        setImages(prev => (pageNum === 1 ? response.photos : [...prev, ...response.photos]));
        setHasMore(response.photos.length === 15);
      } else {
        const response = await searchPexelsVideos(query, pageNum, 15);
        setVideos(prev => (pageNum === 1 ? response.videos : [...prev, ...response.videos]));
        setHasMore(response.videos.length === 15);
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

  const handleApplyImage = async (photo: PexelsPhoto) => {
    setSelectedImage(photo);
    setUploading(true);
    try {
      const uploadResult = await downloadPexelsImage(photo.src.large2x, formId);
      toastSuccess(t('imageAppliedSuccess'));
      onImageApplied(uploadResult.key, uploadResult.dominantColor);
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

  const handleApplyVideo = async (video: PexelsVideo) => {
    setSelectedVideo(video);
    setUploading(true);
    try {
      const uploadResult = await downloadPexelsVideo(video, formId);
      toastSuccess(t('videoAppliedSuccess'));
      onVideoApplied(uploadResult.key, uploadResult.dominantColor);
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
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

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
          <Button variant="outline" size="sm" onClick={handleClose} className="p-2">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col p-6">
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

          <div className="flex-1 overflow-y-auto">
            {mediaType === 'photo' && images.length > 0 && (
              <div className="grid grid-cols-3 gap-4 mb-4">
                {images.map((photo) => (
                  <Card
                    key={photo.id}
                    className={`group transition-all hover:shadow-lg relative overflow-hidden ${
                      uploading && selectedImage?.id === photo.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                  >
                    <div className="aspect-video relative overflow-hidden rounded-lg">
                      <img
                        src={photo.src.medium}
                        alt={photo.alt}
                        className="w-full h-full object-cover"
                      />

                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Button
                            onClick={() => handleApplyImage(photo)}
                            disabled={uploading}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
                          >
                            {uploading && selectedImage?.id === photo.id ? (
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
                      <p className="text-xs text-foreground dark:text-gray-400 truncate font-medium">{photo.alt}</p>
                      <p className="text-xs text-muted-foreground dark:text-gray-500">{t('byAuthor', { values: { author: photo.photographer } })}</p>
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
                        src={video.image}
                        alt={`Pexels video ${video.id}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <Play className="h-8 w-8 text-white/90" />
                      </div>

                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
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
                  </Card>
                ))}
              </div>
            )}

            {hasMore && !loading && (
              <div className="text-center">
                <Button variant="outline" onClick={handleLoadMore}>
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
