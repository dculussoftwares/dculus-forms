import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { useTranslation } from '../hooks/useTranslation';
import { Button, LoadingSpinner } from '@dculus/ui';
import { FileText, Plus, Edit2, Trash2, Eye } from 'lucide-react';
import { GET_TEMPLATES, DELETE_TEMPLATE } from '../graphql/templates';
import TemplateModal from '../components/templates/TemplateModal';

interface Template {
  id: string;
  name: string;
  description?: string;
  category?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/* Ghost icon button for table actions */
const IconBtn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }> = ({ children, danger, ...props }) => (
  <Button
    {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    variant="ghost"
    size="icon"
    className={`h-7 w-7 ${danger ? 'text-destructive hover:bg-[var(--tf-error-bg)] hover:text-destructive' : 'text-muted-foreground'}`}
  >
    {children}
  </Button>
);

export default function TemplatesPage() {
  const { t } = useTranslation('templates');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, loading, error, refetch } = useQuery<any, any>(GET_TEMPLATES);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deleteTemplate] = useMutation(DELETE_TEMPLATE);

  const templates: Template[] = data?.templates || [];

  const handleCreate = () => { setSelectedTemplate(null); setModalMode('create'); setIsModalOpen(true); };
  const handleEdit = (t: Template) => { setSelectedTemplate(t); setModalMode('edit'); setIsModalOpen(true); };
  const handleView = (t: Template) => { setSelectedTemplate(t); setModalMode('view'); setIsModalOpen(true); };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await deleteTemplate({ variables: { id } });
      refetch();
    } catch (err) {
      console.error('Error deleting template:', err);
    }
  };

  const handleModalClose = () => { setIsModalOpen(false); setSelectedTemplate(null); refetch(); };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 text-center">
        <h2 className="text-sm font-semibold mb-1 text-primary">Unable to load templates</h2>
        <p className="text-xs mb-3 text-muted-foreground">{error.message}</p>
        <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-primary">{t('pageTitle', { defaultValue: 'Templates' })}</h1>
          <p className="text-xs mt-0.5 text-muted-foreground">{t('pageSubtitle', { defaultValue: 'Manage form templates' })}</p>
        </div>
        <Button onClick={handleCreate} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          {t('createTemplate', { defaultValue: 'Create Template' })}
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-white overflow-hidden" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
        {loading ? (
          <div className="flex justify-center py-16"><LoadingSpinner /></div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--tf-faint)' }}>
              <FileText className="h-6 w-6 text-[var(--tf-icon-gray)]" />
            </div>
            <p className="text-sm font-medium mb-1 text-primary">No templates yet</p>
            <p className="text-xs mb-5 text-muted-foreground">{t('emptyState.description', { defaultValue: 'Create your first template to get started' })}</p>
            <Button onClick={handleCreate} size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              {t('createTemplate', { defaultValue: 'Create Template' })}
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--tf-border-light)' }}>
                  {['Name', 'Category', 'Description', 'Status', 'Created', ''].map(h => (
                    <th key={h} className={`px-5 py-3 text-[10px] font-semibold uppercase tracking-wide ${h ? 'text-left' : 'text-right'}`} style={{ color: 'var(--tf-muted)', backgroundColor: 'var(--tf-faint)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white">
                {templates.map((template, i) => (
                  <tr
                    key={template.id}
                    className="hover:bg-[var(--tf-tab-bg-faint)] transition-colors"
                    style={{ borderTop: i > 0 ? '1px solid rgba(81,76,84,0.07)' : undefined }}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--tf-icon-salmon)' }}>
                          <FileText className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <span className="text-sm font-medium text-primary">{template.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: 'var(--tf-faint)', color: 'var(--tf-muted)', border: '1px solid var(--tf-border)' }}>
                        {template.category || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 max-w-xs">
                      <p className="text-xs truncate text-muted-foreground">{template.description || '—'}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={template.isActive
                          ? { backgroundColor: 'var(--tf-green-bg)', color: 'var(--tf-green)', border: '1px solid var(--tf-green-bg-md)' }
                          : { backgroundColor: 'var(--tf-error-bg)', color: 'var(--tf-error)', border: '1px solid var(--tf-error-bg-lg)' }
                        }
                      >
                        {template.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">
                      {new Date(template.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <IconBtn onClick={() => handleView(template)} title="View"><Eye className="h-3.5 w-3.5" /></IconBtn>
                        <IconBtn onClick={() => handleEdit(template)} title="Edit"><Edit2 className="h-3.5 w-3.5" /></IconBtn>
                        <IconBtn onClick={() => handleDelete(template.id, template.name)} danger title="Delete"><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TemplateModal isOpen={isModalOpen} onClose={handleModalClose} mode={modalMode} template={selectedTemplate} />
    </div>
  );
}
