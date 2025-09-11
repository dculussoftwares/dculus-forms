import React from 'react';
import { Type, CheckSquare, Calendar, List, Hash, AtSign } from 'lucide-react';
import { FieldType } from '@dculus/types';

export const getFieldIcon = (fieldType: FieldType): React.ReactNode => {
  switch (fieldType) {
    case FieldType.TEXT_INPUT_FIELD:
    case FieldType.TEXT_AREA_FIELD:
      return <Type className="h-4 w-4" />;
    
    case FieldType.EMAIL_FIELD:
      return <AtSign className="h-4 w-4" />;
    
    case FieldType.NUMBER_FIELD:
      return <Hash className="h-4 w-4" />;
    
    case FieldType.CHECKBOX_FIELD:
      return <CheckSquare className="h-4 w-4" />;
    
    case FieldType.DATE_FIELD:
      return <Calendar className="h-4 w-4" />;
    
    case FieldType.SELECT_FIELD:
    case FieldType.RADIO_FIELD:
      return <List className="h-4 w-4" />;
    
    default:
      return <Type className="h-4 w-4" />;
  }
};