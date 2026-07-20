import { FormPage, FormLayout } from '@dculus/types';
import { RendererMode } from '@dculus/utils';

export interface LayoutProps {
  pages: FormPage[];
  layout?: FormLayout;
  className?: string;
  onLayoutChange?: (updates: Partial<FormLayout>) => void;
  cdnEndpoint?: string;
  mode?: RendererMode;
  /** Page id to open on first render instead of the first page. Falls back to the first page if not found. */
  initialPageId?: string;
}