
import React from 'react';
import {
  Card,
  LoadingSpinner,
  TypographyH1,
  TypographyP,
  Button
} from '@dculus/ui';
import { useQuery } from '@apollo/client';
import { GET_TEMPLATES } from '../graphql/templates';
import { UseTemplatePopover } from '../components/UseTemplatePopover';
import { useTranslation } from '../hooks/useTranslation';
import { getCdnEndpoint } from '../lib/config';

/**
 * Templates Page - displays available form templates for selection.
 */

const Templates: React.FC = () => {
  const { data, loading, error } = useQuery(GET_TEMPLATES);
  const cdnEndpoint = getCdnEndpoint();
  const { t, locale } = useTranslation('templates');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      {/* Hero Section */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="text-center">
            <TypographyH1 className="mb-4 text-slate-900">
              {t('hero.title')}
            </TypographyH1>
            <TypographyP className="text-lg text-slate-600 max-w-2xl mx-auto">
              {t('hero.subtitle')}
            </TypographyP>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner aria-label={t('status.loadingAria')} />
          </div>
        )}
        
        {error && (
          <div className="text-center py-20">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
              <div className="text-red-600 font-medium mb-2">{t('status.errorTitle')}</div>
              <div className="text-red-500 text-sm">{t('status.errorMessage')}</div>
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            {data?.templates?.length === 0 ? (
              <div className="text-center py-20">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 max-w-md mx-auto">
                  <div className="text-slate-600 font-medium mb-2">{t('status.emptyTitle')}</div>
                  <div className="text-slate-500 text-sm">{t('status.emptyMessage')}</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {data?.templates?.map((template: any) => {
                  const backgroundImage = template.formSchema?.layout?.backgroundImageKey;
                  const backgroundImageUrl = backgroundImage && cdnEndpoint 
                    ? `${cdnEndpoint}/${backgroundImage}`
                    : null;
                  return (
                    <Card 
                      key={template.id} 
                      data-testid="template-card"
                      className="group relative overflow-hidden border-0 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white"
                    >
                      {/* Template Preview */}
                      <div className="relative overflow-hidden">
                        {backgroundImageUrl ? (
                          <div 
                            className="h-48 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                            style={{ backgroundImage: `url(${backgroundImageUrl})` }}
                          >
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
                          </div>
                        ) : (
                          <div className="h-48 bg-gradient-to-br from-slate-100 via-slate-50 to-white flex items-center justify-center relative">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.1)_0%,transparent_50%)]" />
                            <div className="text-slate-400 text-center">
                              <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-slate-200 flex items-center justify-center">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                              <span className="text-sm font-medium">{t('card.fallbackLabel')}</span>
                            </div>
                          </div>
                        )}
                        
                        {/* Overlay on hover */}
                        <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        
                        {/* Use Template Button */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <UseTemplatePopover
                            templateId={template.id}
                            templateName={template.name}
                          >
                            <Button variant="secondary" className="px-6 py-2 font-medium shadow-lg hover:shadow-xl transition-shadow duration-200">
                              {t('card.useTemplate')}
                            </Button>
                          </UseTemplatePopover>
                        </div>
                      </div>

                      {/* Template Info */}
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {template.name}
                          </h3>
                          {template.category && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 shrink-0 ml-3">
                              {template.category}
                            </span>
                          )}
                        </div>
                        
                        <p className="text-slate-600 text-sm mb-4 leading-relaxed" style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}>
                          {template.description || t('card.fallbackDescription')}
                        </p>
                        
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {template.createdAt && !isNaN(new Date(template.createdAt).getTime())
                              ? new Date(template.createdAt).toLocaleDateString(locale, { 
                                  month: 'short', 
                                  day: 'numeric',
                                  year: 'numeric'
                                })
                              : t('card.recentlyCreated')
                            }
                          </div>
                          <div className="flex items-center text-green-600">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {t('card.ready')}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Templates;
