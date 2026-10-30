import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="prose-equidy">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="not-prose my-3 overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-left text-xs [&_td]:border-t [&_td]:border-line [&_td]:px-3 [&_td]:py-2 [&_th]:bg-elevated [&_th]:px-3 [&_th]:py-2 [&_th]:font-medium [&_th]:text-muted [&_td]:tabular-nums">{children}</table>
            </div>
          ),
          a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});
