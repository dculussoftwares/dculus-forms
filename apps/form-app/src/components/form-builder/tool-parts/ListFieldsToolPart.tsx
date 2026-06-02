import React from 'react';
import { Loader2 } from 'lucide-react';
import type { ListFieldsToolPart } from '../../../lib/aiAgentTypes';

interface Props {
  part: ListFieldsToolPart;
}

const ListFieldsToolPart: React.FC<Props> = ({ part }) => {
  const state = (part as any).state as string;

  if (state === 'input-streaming' || state === 'input-available') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Reading form structure…
      </span>
    );
  }

  const pages = part.output?.pages ?? [];
  const pageCount = pages.length;

  // Each page string: `p1 "Title" [id:...]: field1|type|label|req, field2|...`
  const fieldCount = pages.reduce((sum, p) => {
    const colonIdx = p.indexOf(']:');
    if (colonIdx === -1) return sum;
    const fieldsStr = p.slice(colonIdx + 2).trim();
    if (!fieldsStr || fieldsStr === '(empty)') return sum;
    return sum + fieldsStr.split(', ').length;
  }, 0);

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
      Scanned {pageCount} page{pageCount !== 1 ? 's' : ''}, {fieldCount} field{fieldCount !== 1 ? 's' : ''}
    </span>
  );
};

export default ListFieldsToolPart;
