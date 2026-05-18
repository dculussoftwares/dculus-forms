import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
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
    className={`h-7 w-7 ${danger ? 'text-[#ce5d55] hover:bg-[rgba(206,93,85,0.08)] hover:text-[#ce5d55]' : 'text-[#655d67]'}`}
  >
    {children}
  </Button>
);

export default function TemplatesPage() {
  const { t } = useTranslation('templates');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');

  const { data, loading, error, refetch } = useQuery(GET_TEMPLATES);
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
        <h2 className="text-sm font-semibold mb-1" style={{ color: '#3c323e' }}>Unable to load templates</h2>
        <p className="text-xs mb-3" style={{ color: '#655d67' }}>{error.message}</p>
        <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: '#3c323e' }}>{t('pageTitle', { defaultValue: 'Templates' })}</h1>
          <p className="text-xs mt-0.5" style={{ color: '#655d67' }}>{t('pageSubtitle', { defaultValue: 'Manage form templates' })}</p>
        </div>
        <Button onClick={handleCreate} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          {t('createTemplate', { defaultValue: 'Create Template' })}
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-white overflow-hidden" style={{ border: '1px solid rgba(81,76,84,0.10)', boxShadow: '0 1px 4px rgba(60,50,62,0.06)' }}>
        {loading ? (
          <div className="flex justify-center py-16"><LoadingSpinner /></div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: '#f7f7f8' }}>
              <FileText className="h-6 w-6" style={{ color: '#dedcde' }} />
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: '#3c323e' }}>No templates yet</p>
            <p className="text-xs mb-5" style={{ color: '#655d67' }}>{t('emptyState.description', { defaultValue: 'Create your first template to get started' })}</p>
            <Button onClick={handleCreate} size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              {t('createTemplate', { defaultValue: 'Create Template' })}
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(81,76,84,0.08)' }}>
                  {['Name', 'Category', 'Description', 'Status', 'Created', ''].map(h => (
                    <th key={h} className={`px-5 py-3 text-[10px] font-semibold uppercase tracking-wide ${h ? 'text-left' : 'text-right'}`} style={{ color: '#655d67', backgroundColor: '#f7f7f8' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white">
                {templates.map((template, i) => (
                  <tr
                    key={template.id}
                    className="hover:bg-[rgba(87,84,91,0.025)] transition-colors"
                    style={{ borderTop: i > 0 ? '1px solid rgba(81,76,84,0.07)' : undefined }}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#f8cdd8' }}>
                          <FileText className="h-3.5 w-3.5" style={{ color: '#3c323e' }} />
                        </div>
                        <span className="text-sm font-medium" style={{ color: '#3c323e' }}>{template.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: '#f7f7f8', color: '#655d67', border: '1px solid rgba(81,76,84,0.12)' }}>
                        {template.category || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 max-w-xs">
                      <p className="text-xs truncate" style={{ color: '#655d67' }}>{template.description || '—'}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={template.isActive
                          ? { backgroundColor: 'rgba(23,119,103,0.08)', color: '#177767', border: '1px solid rgba(23,119,103,0.16)' }
                          : { backgroundColor: 'rgba(206,93,85,0.08)', color: '#ce5d55', border: '1px solid rgba(206,93,85,0.16)' }
                        }
                      >
                        {template.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs" style={{ color: '#655d67' }}>
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
