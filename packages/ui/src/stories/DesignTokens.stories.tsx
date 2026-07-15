import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

/* ── Color swatch ── */
const Swatch: React.FC<{ hex: string; name: string; usage?: string }> = ({ hex, name, usage }) => (
  <div className="flex flex-col gap-1.5">
    <div className="h-14 w-full rounded-lg border border-black/8 shadow-sm" style={{ backgroundColor: hex }} />
    <div>
      <p className="text-xs font-semibold text-[#3c323e]">{name}</p>
      <p className="text-[10px] font-mono text-[#655d67]">{hex}</p>
      {usage && <p className="text-[10px] text-[#655d67] mt-0.5">{usage}</p>}
    </div>
  </div>
);

const TokenGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-10">
    <h2 className="text-sm font-semibold text-[#3c323e] mb-4 pb-2 border-b border-[rgba(81,76,84,0.12)]">{title}</h2>
    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-4">{children}</div>
  </div>
);

/* ── Type specimen ── */
const TypeRow: React.FC<{ size: string; class_: string; weight: string; sample: string }> = ({ size, class_, weight, sample }) => (
  <div className="flex items-baseline gap-6 py-3 border-b border-[rgba(81,76,84,0.08)]">
    <div className="w-32 shrink-0">
      <p className="text-xs text-[#655d67]">{size}</p>
      <p className="text-[10px] font-mono text-[#655d67] mt-0.5">{class_}</p>
    </div>
    <p className={`${class_} text-[#3c323e]`} style={{ fontWeight: weight }}>{sample}</p>
  </div>
);

/* ── Shadow specimen ── */
const ShadowBox: React.FC<{ shadow: string; name: string }> = ({ shadow, name }) => (
  <div className="flex flex-col items-center gap-2">
    <div className="w-20 h-20 rounded-xl bg-white" style={{ boxShadow: shadow }} />
    <p className="text-[10px] font-mono text-[#655d67]">{name}</p>
  </div>
);

/* ── Story component ── */
const DesignTokensComponent: React.FC = () => (
  <div className="p-8 bg-[#f7f7f8] min-h-screen">
    <div className="max-w-5xl mx-auto space-y-12">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[#3c323e] mb-1">Design Tokens</h1>
        <p className="text-sm text-[#655d67]">Typeform-extracted exact values — the single source of truth for the dculus-forms design system.</p>
      </div>

      {/* Neutral palette */}
      <TokenGroup title="Neutral Palette — Aubergine-tinted">
        <Swatch hex="#2a222b" name="Neutral 1000" usage="Darkest text" />
        <Swatch hex="#3c323e" name="Primary Dark" usage="Buttons, headings" />
        <Swatch hex="#4c414e" name="Body text" usage="Active tabs, normal" />
        <Swatch hex="#655d67" name="Muted text" usage="Inactive, hints" />
        <Swatch hex="#837a85" name="Neutral 600" />
        <Swatch hex="#dedcde" name="Border gray" usage="Neutral border" />
        <Swatch hex="#f7f7f8" name="Page bg" usage="App background" />
        <Swatch hex="#ffffff" name="White" usage="Cards, panels" />
      </TokenGroup>

      {/* Interactive */}
      <TokenGroup title="Interactive & Status">
        <Swatch hex="#177767" name="Green CTA" usage="View plans, positive" />
        <Swatch hex="#c9ece3" name="Teal tint" usage="Teal icon bg" />
        <Swatch hex="#ce5d55" name="Error" usage="Destructive, errors" />
        <Swatch hex="rgba(255,255,255,0.8)" name="Ghost bg" usage="Outline buttons" />
        <Swatch hex="rgba(87,84,91,0.06)" name="Active tab bg" usage="Hover / active" />
        <Swatch hex="#f6fafd" name="Badge bg" usage="Count badges" />
        <Swatch hex="#01487f" name="Badge text" usage="Count badge text" />
      </TokenGroup>

      {/* Field icon palette */}
      <TokenGroup title="Field Icon Palette">
        <Swatch hex="#f8cdd8" name="Salmon" usage="Input fields" />
        <Swatch hex="#c9ece3" name="Teal" usage="Time / clock" />
        <Swatch hex="#dedcde" name="Gray" usage="Generic fields" />
        <Swatch hex="#ddd6fa" name="Lavender" usage="Choice / rating" />
        <Swatch hex="#fbe19d" name="Yellow" usage="Number fields" />
        <Swatch hex="#c4e3ba" name="Green" usage="Opinion scale" />
        <Swatch hex="#f7edfc" name="Light purple" usage="Analytics" />
      </TokenGroup>

      {/* Typography */}
      <div className="mb-10">
        <h2 className="text-sm font-semibold text-[#3c323e] mb-4 pb-2 border-b border-[rgba(81,76,84,0.12)]">Typography — Inter</h2>
        <TypeRow size="text-xs / 12px"   class_="text-xs"   weight="400" sample="The quick brown fox jumps over the lazy dog" />
        <TypeRow size="text-sm / 14px"   class_="text-sm"   weight="400" sample="The quick brown fox jumps over the lazy dog" />
        <TypeRow size="text-sm / 14px"   class_="text-sm"   weight="500" sample="Medium weight — buttons, labels, active tabs" />
        <TypeRow size="text-sm / 14px"   class_="text-sm"   weight="600" sample="Semibold — section headings, card titles" />
        <TypeRow size="text-base / 16px" class_="text-base" weight="400" sample="Base body text" />
        <TypeRow size="text-lg / 18px"   class_="text-lg"   weight="400" sample="Form viewer answer text" />
        <TypeRow size="text-xl / 20px"   class_="text-xl"   weight="400" sample="Form viewer labels" />
        <TypeRow size="text-2xl / 24px"  class_="text-2xl"  weight="300" sample="Typeform stat numbers — light weight" />
      </div>

      {/* Spacing / radius */}
      <div className="mb-10">
        <h2 className="text-sm font-semibold text-[#3c323e] mb-4 pb-2 border-b border-[rgba(81,76,84,0.12)]">Border Radius</h2>
        <div className="flex items-end gap-6 flex-wrap">
          {[
            { label: 'rounded (4px)', cls: 'rounded' },
            { label: 'rounded-lg (8px)', cls: 'rounded-lg' },
            { label: 'rounded-xl (12px)', cls: 'rounded-xl' },
            { label: 'rounded-2xl (16px)', cls: 'rounded-2xl' },
            { label: 'rounded-full (pill)', cls: 'rounded-full' },
          ].map(({ label, cls }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <div className={`w-16 h-16 bg-[#3c323e] ${cls}`} />
              <p className="text-[10px] text-[#655d67] text-center">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Shadows */}
      <div className="mb-10">
        <h2 className="text-sm font-semibold text-[#3c323e] mb-4 pb-2 border-b border-[rgba(81,76,84,0.12)]">Shadows</h2>
        <div className="flex items-end gap-8 flex-wrap">
          <ShadowBox shadow="0 1px 4px rgba(60,50,62,0.06)" name="Card (default)" />
          <ShadowBox shadow="0 4px 16px rgba(60,50,62,0.10)" name="Card hover" />
          <ShadowBox shadow="0 8px 24px rgba(60,50,62,0.12)" name="Dropdown / dialog" />
          <ShadowBox shadow="0 16px 48px rgba(60,50,62,0.18)" name="Modal" />
        </div>
      </div>

      {/* Border tokens */}
      <div className="mb-10">
        <h2 className="text-sm font-semibold text-[#3c323e] mb-4 pb-2 border-b border-[rgba(81,76,84,0.12)]">Border Tokens</h2>
        <div className="space-y-3">
          {[
            { border: '1px solid rgba(81,76,84,0.08)', label: 'Separator / row divider' },
            { border: '1px solid rgba(81,76,84,0.10)', label: 'Card border (default)' },
            { border: '1px solid rgba(81,76,84,0.12)', label: 'Header border-bottom' },
            { border: '1px solid rgba(81,76,84,0.15)', label: 'Ghost button border / input border' },
            { border: '2px solid #3c323e', label: 'Recommended plan / selected' },
          ].map(({ border, label }) => (
            <div key={label} className="flex items-center gap-4">
              <div className="w-40 h-10 rounded-lg bg-white" style={{ border }} />
              <p className="text-xs text-[#655d67]">{label}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  </div>
);

const meta: Meta = {
  title: 'Design System/Tokens',
  parameters: { layout: 'fullscreen', backgrounds: { default: 'app' } },
};
export default meta;

type Story = StoryObj;
export const AllTokens: Story = { render: () => <DesignTokensComponent /> };
