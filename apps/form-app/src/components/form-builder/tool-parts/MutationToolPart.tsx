import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@dculus/utils';
import type { MutationToolPart } from '../../../lib/aiAgentTypes';
import { buildOpLabel } from '../../../hooks/useAIChat';
import { msgVariants, easeOut } from '../aiChatMotion';

interface Props {
  part: MutationToolPart;
}

function getActionLabel(part: MutationToolPart): string {
  switch (part.type) {
    case 'tool-addField': return 'Adding field…';
    case 'tool-updateFields': return 'Updating fields…';
    case 'tool-relocateField': return 'Moving field…';
    case 'tool-reorder': return 'Reordering…';
    case 'tool-updateLayout': return 'Updating layout…';
    case 'tool-renamePage': return 'Renaming page…';
    case 'tool-addPage': return 'Adding page…';
    case 'tool-navigateToPage': return 'Navigating to page…';
    // Default covers legacy mutation parts from old conversations
    // (e.g. tool-updateField, tool-moveField, tool-reorderFields, and the
    // old immediate tool-removeFields/tool-removePage before they became proposals).
    default: return 'Working…';
  }
}

function getDoneLabel(part: MutationToolPart): string {
  if (!part.output) return 'Changed form';
  return buildOpLabel(part.output as Record<string, unknown>);
}

const MutationToolPart: React.FC<Props> = ({ part }) => {
  const state = (part as any).state as string;

  if (state === 'input-streaming') {
    return (
      <motion.span
        variants={msgVariants}
        initial="hidden"
        animate="visible"
        transition={easeOut}
        className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60" />
        {part.type.slice(5)}
      </motion.span>
    );
  }

  if (state === 'input-available') {
    return (
      <motion.span
        variants={msgVariants}
        initial="hidden"
        animate="visible"
        transition={easeOut}
        className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        {getActionLabel(part)}
      </motion.span>
    );
  }

  return (
    <motion.span
      variants={msgVariants}
      initial="hidden"
      animate="visible"
      transition={easeOut}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700'
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      {getDoneLabel(part)}
    </motion.span>
  );
};

export default MutationToolPart;
