import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import type { GetFieldToolPart } from '../../../lib/aiAgentTypes';
import { msgVariants, easeOut } from '../aiChatMotion';

interface Props {
  part: GetFieldToolPart;
}

const GetFieldToolPart: React.FC<Props> = ({ part }) => {
  const state = (part as any).state as string;

  if (state === 'input-streaming' || state === 'input-available') {
    return (
      <motion.span
        variants={msgVariants}
        initial="hidden"
        animate="visible"
        transition={easeOut}
        className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking field details…
      </motion.span>
    );
  }

  return (
    <motion.span
      variants={msgVariants}
      initial="hidden"
      animate="visible"
      transition={easeOut}
      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground"
    >
      Read field details
    </motion.span>
  );
};

export default GetFieldToolPart;
