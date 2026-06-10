import React, { useState, useRef } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@dculus/ui';
import { Check, Plus, Tag, X } from 'lucide-react';
import { cn } from '@dculus/utils';
import { FormResponse } from '@dculus/types';
import {
  ADD_TAG_TO_RESPONSE,
  REMOVE_TAG_FROM_RESPONSE,
  CREATE_TAG,
} from '../../graphql/mutations';
import { GET_FORM_TAGS } from '../../graphql/queries';

const TAG_FRAGMENT = gql`
  fragment TagCellFields on ResponseTag {
    id
    name
    color
  }
`;

const PREVIEW_TAG_NAME = '__preview__';

const PRESET_COLORS = [
  '#6366f1', // indigo (default)
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#84cc16', // lime
  '#f59e0b', // amber
  '#f97316', // orange
  '#ef4444', // red
  '#ec4899', // pink
  '#a855f7', // purple
];

interface ResponseTagItem {
  id: string;
  name: string;
  color: string;
}

interface TagsCellProps {
  response: FormResponse & { tags?: ResponseTagItem[] };
  formId: string;
  formTags: ResponseTagItem[];
  t: (key: string, options?: { values?: Record<string, string | number> }) => string;
}

export const TagsCell: React.FC<TagsCellProps> = ({ response, formId, formTags, t }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const inputRef = useRef<HTMLInputElement>(null);

  const assignedIds = new Set((response.tags ?? []).map((t) => t.id));

  const [addTag, { loading: adding }] = useMutation<any, any>(ADD_TAG_TO_RESPONSE, {
    update(cache, _result, { variables }) {
      const { responseId, tagId } = variables ?? {};
      const tagData = cache.readFragment<{ id: string; name: string; color: string }>({
        id: cache.identify({ __typename: 'ResponseTag', id: tagId }),
        fragment: TAG_FRAGMENT,
      });
      if (!tagData) return;
      cache.modify({
        id: cache.identify({ __typename: 'FormResponse', id: responseId }),
        fields: {
          tags(existingRefs = [], { readField }) {
            if (existingRefs.some((ref: any) => readField('id', ref) === tagId)) return existingRefs;
            const newRef = cache.writeFragment({ data: { __typename: 'ResponseTag', ...tagData }, fragment: TAG_FRAGMENT });
            return [...existingRefs, newRef];
          },
        },
      });
    },
  });

  const [removeTag, { loading: removing }] = useMutation<any, any>(REMOVE_TAG_FROM_RESPONSE, {
    update(cache, _result, { variables }) {
      const { responseId, tagId } = variables ?? {};
      cache.modify({
        id: cache.identify({ __typename: 'FormResponse', id: responseId }),
        fields: {
          tags(existingRefs = [], { readField }) {
            return existingRefs.filter((ref: any) => readField('id', ref) !== tagId);
          },
        },
      });
    },
  });

  const [createTag, { loading: creating }] = useMutation<any, any>(CREATE_TAG, {
    update(cache, { data }) {
      if (!data?.createTag) return;
      const newTag = { __typename: 'ResponseTag', ...data.createTag };
      cache.updateQuery<{ formTags: { id: string; name: string; color: string }[] }>(
        { query: GET_FORM_TAGS, variables: { formId } },
        (existing) => ({ formTags: [...(existing?.formTags ?? []), newTag] }),
      );
    },
  });

  const loading = adding || removing || creating;

  const filtered = formTags
    .filter((t) => t.name !== PREVIEW_TAG_NAME)
    .filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));
  const trimmed = search.trim();
  const canCreate =
    trimmed.length > 0 &&
    trimmed !== PREVIEW_TAG_NAME &&
    !formTags.some((t) => t.name.toLowerCase() === trimmed.toLowerCase());

  const handleToggle = async (tag: ResponseTagItem) => {
    if (assignedIds.has(tag.id)) {
      await removeTag({ variables: { responseId: response.id, tagId: tag.id } });
    } else {
      await addTag({ variables: { responseId: response.id, tagId: tag.id } });
    }
  };

  const handleCreate = async () => {
    if (!trimmed) return;
    const { data } = await createTag({ variables: { formId, name: trimmed, color: selectedColor } });
    if (data?.createTag?.id) {
      await addTag({ variables: { responseId: response.id, tagId: data.createTag.id } });
    }
    setSearch('');
    setSelectedColor(PRESET_COLORS[0]);
  };

  const tags = response.tags ?? [];

  return (
    <div
      className="flex items-center gap-1 flex-wrap min-h-[24px]"
      onClick={(e) => e.stopPropagation()}
    >
      {tags.map((tag) => {
        if (tag.name === PREVIEW_TAG_NAME) {
          return (
            <span
              key={tag.id}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-amber-300 bg-amber-100 text-amber-700 select-none"
            >
              Preview
            </span>
          );
        }
        return (
          <span
            key={tag.id}
            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium text-white select-none"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeTag({ variables: { responseId: response.id, tagId: tag.id } });
              }}
              className="ml-0.5 opacity-70 hover:opacity-100 transition-opacity"
              disabled={loading}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        );
      })}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center w-5 h-5 rounded-full border border-dashed text-muted-foreground hover:text-foreground hover:border-solid',
              tags.length > 0 && 'opacity-0 group-hover:opacity-100'
            )}
            onClick={(e) => { e.stopPropagation(); setOpen(true); }}
            title={t('table.tags.addTag')}
          >
            <Plus className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start" side="bottom">
          <Command>
            <CommandInput
              ref={inputRef}
              placeholder={t('table.tags.searchOrCreate')}
              value={search}
              onValueChange={setSearch}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canCreate) {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />

            {/* Color swatches — shown when user is about to create a new tag */}
            {canCreate && (
              <div className="px-3 py-2 border-b">
                <p className="text-[10px] text-muted-foreground mb-1.5">Pick a colour</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onMouseDown={(e) => {
                        e.preventDefault(); // keep focus in CommandInput
                        setSelectedColor(color);
                      }}
                      className="w-5 h-5 rounded-full transition-all duration-150 flex-shrink-0"
                      style={{
                        backgroundColor: color,
                        boxShadow: selectedColor === color
                          ? `0 0 0 2px white, 0 0 0 4px ${color}`
                          : 'none',
                      }}
                      title={color}
                    />
                  ))}
                </div>
                {/* Live preview of the new tag */}
                <div className="mt-2">
                  <span
                    className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: selectedColor }}
                  >
                    {trimmed}
                  </span>
                </div>
              </div>
            )}

            <CommandList>
              <CommandEmpty>
                {canCreate ? (
                  <button
                    className="w-full px-3 py-2 text-xs text-left hover:bg-accent flex items-center gap-2"
                    onClick={handleCreate}
                    disabled={loading}
                  >
                    <Tag className="h-3 w-3 text-muted-foreground" />
                    {t('table.tags.createTag', { values: { name: trimmed } })}
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground px-3 py-2">{t('table.tags.noTags')}</span>
                )}
              </CommandEmpty>
              {filtered.length > 0 && (
                <CommandGroup>
                  {filtered.map((tag) => (
                    <CommandItem
                      key={tag.id}
                      onSelect={() => handleToggle(tag)}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1 text-xs">{tag.name}</span>
                      {assignedIds.has(tag.id) && (
                        <Check className="h-3 w-3 text-primary" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {canCreate && filtered.length > 0 && (
                <>
                  <div className="border-t mx-1 my-1" />
                  <CommandItem
                    onSelect={handleCreate}
                    className="flex items-center gap-2 cursor-pointer text-xs"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: selectedColor }}
                    />
                    {t('table.tags.createTag', { values: { name: trimmed } })}
                  </CommandItem>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};
