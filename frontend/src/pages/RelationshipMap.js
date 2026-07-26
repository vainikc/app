import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import DOMPurify from 'dompurify';
import ForceGraph2D from 'react-force-graph-2d';
import { Sparkles, GitCompareArrows, RefreshCw, Loader2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DeepDive = () => {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [graphLoading, setGraphLoading] = useState(true);
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ width: 800, height: 460 });

  // AI Snapshot state
  const [summaries, setSummaries] = useState(null);
  const [summariesLoading, setSummariesLoading] = useState(false);

  // Compare dialog
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareData, setCompareData] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState(null);

  useEffect(() => {
    fetchGraph();
    fetchSummaries();
    const handleResize = () => {
      if (containerRef.current) {
        setDims({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight || 460,
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchGraph = async () => {
    try {
      const res = await axios.get(`${API}/relationships`);
      setGraphData(res.data);
    } catch (error) {
      console.error('Error:', error);
    }
    setGraphLoading(false);
  };

  const fetchSummaries = async () => {
    setSummariesLoading(true);
    try {
      const res = await axios.get(`${API}/insights/dashboard/summaries`);
      setSummaries(res.data.summaries || []);
    } catch {
      setSummaries([]);
    }
    setSummariesLoading(false);
  };

  const openCompare = async () => {
    setCompareOpen(true);
    if (compareData) return;
    setCompareLoading(true);
    setCompareError(null);
    try {
      const res = await axios.get(`${API}/insights/compare`);
      setCompareData(res.data);
    } catch (e) {
      setCompareError(e.response?.data?.detail || 'Comparison failed');
    }
    setCompareLoading(false);
  };

  const getNodeColor = (node) => {
    const palette = { personal: '#a3e635', unknown: '#525252' };
    if (palette[node.category]) return palette[node.category];
    let hash = 0;
    const cat = String(node.category || 'x');
    for (let i = 0; i < cat.length; i++) hash = cat.charCodeAt(i) + ((hash << 5) - hash);
    const colors = ['#ffffff', '#a3e635', '#22c55e', '#d4d4d8', '#737373'];
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="h-screen p-6 max-w-[1600px] flex flex-col overflow-hidden">
      {/* Compact header */}
      <div className="mb-4 pl-8 hero-crosshair flex items-end justify-between gap-6 shrink-0">
        <div>
          <div className="inline-block text-[10px] font-mono uppercase tracking-[0.3em] text-[#a3e635] mb-1">
            Network + Intelligence
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Deep Dive</h1>
          <p className="text-xs text-[#a1a1aa] mt-0.5">Relationships, AI reads, and head-to-head comparisons — all in view.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={openCompare}
            data-testid="compare-accounts-btn"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-[#1f1f1f] text-[#a1a1aa] hover:text-[#a3e635] hover:border-[#a3e635]/40 hover:shadow-[0_0_20px_-6px_rgba(163,230,53,0.35)] transition-all"
          >
            <GitCompareArrows className="w-3.5 h-3.5" strokeWidth={1.75} />
            Compare with AI
          </button>
          <button
            onClick={fetchSummaries}
            disabled={summariesLoading}
            data-testid="ai-snapshot-generate-btn"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-[#1f1f1f] text-[#a1a1aa] hover:text-white hover:border-[#333] transition-colors disabled:opacity-50"
          >
            {summariesLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {summaries ? 'Refresh AI' : 'Load AI'}
          </button>
        </div>
      </div>

      {/* Two-column grid — network on left, AI on right — filling remaining height */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 flex-1 min-h-0">
        {/* Relationship map — 3/5 width */}
        <div className="lg:col-span-3 card-modern rounded-md p-4 flex flex-col min-h-0" data-testid="relationship-map">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <h2 className="text-sm font-semibold text-white accent-bar">Ties & Trails</h2>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#525252]">
              {graphData.nodes.length} nodes · {graphData.links.length} links
            </span>
          </div>
          <div ref={containerRef} className="rounded-sm flex-1 min-h-0 bg-black relative overflow-hidden">
            {graphLoading ? (
              <div className="absolute inset-0 flex items-center justify-center text-[#737373] text-sm">Loading network…</div>
            ) : graphData.nodes.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-lg text-[#a1a1aa] mb-1">No connections yet</div>
                  <p className="text-xs text-[#737373]">Track multiple profiles to reveal the web.</p>
                </div>
              </div>
            ) : (
              <ForceGraph2D
                graphData={graphData}
                width={dims.width}
                height={dims.height}
                backgroundColor="#000000"
                nodeLabel={(n) => `@${n.label} · ${n.followers?.toLocaleString() || 0} followers`}
                linkColor={() => 'rgba(163, 230, 53, 0.22)'}
                linkWidth={(l) => Math.max(1, l.value / 3)}
                nodeCanvasObject={(node, ctx, globalScale) => {
                  const label = `@${node.label}`;
                  const fontSize = 10 / globalScale;
                  const radius = Math.max(5, Math.min(16, Math.log10((node.followers || 1) + 10) * 3));
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
                  ctx.fillStyle = getNodeColor(node);
                  ctx.fill();
                  if (node.verified) {
                    ctx.strokeStyle = '#a3e635';
                    ctx.lineWidth = 2 / globalScale;
                    ctx.stroke();
                  }
                  ctx.font = `${fontSize}px 'JetBrains Mono'`;
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'top';
                  ctx.fillStyle = '#fafafa';
                  ctx.fillText(label, node.x, node.y + radius + 2);
                }}
                nodePointerAreaPaint={(node, color, ctx) => {
                  const radius = Math.max(5, Math.min(16, Math.log10((node.followers || 1) + 10) * 3));
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
                  ctx.fillStyle = color;
                  ctx.fill();
                }}
              />
            )}
          </div>
        </div>

        {/* AI Snapshot — 2/5 width */}
        <div className="lg:col-span-2 card-modern rounded-md p-4 flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-3 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-[#a3e635]" strokeWidth={1.75} />
            <h2 className="text-sm font-semibold text-white accent-bar">AI Insights</h2>
            <span className="ml-auto text-[10px] font-mono uppercase tracking-wider text-[#a3e635] bg-[#a3e6351a] border border-[#a3e63533] px-1.5 py-0.5 rounded">
              GPT-5.4
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">
            {summariesLoading && !summaries && (
              <div className="flex items-center gap-2 text-xs text-[#a1a1aa] py-6 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Analysing accounts…
              </div>
            )}
            {!summaries && !summariesLoading && (
              <div className="text-center text-xs text-[#a1a1aa] py-8">
                Click <span className="text-[#a3e635]">Load AI</span> to generate.
              </div>
            )}
            {summaries && summaries.length === 0 && !summariesLoading && (
              <div className="text-center text-xs text-[#737373] py-8">No tracked accounts yet.</div>
            )}
            {summaries && summaries.map((s) => (
              <div
                key={s.username}
                data-testid={`ai-summary-${s.username}`}
                className="rounded-md p-3 bg-[#0a0a0a] border border-[#1a1a1a] border-l-2 border-l-[#a3e635]/50"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono text-xs font-medium text-white">@{s.username}</span>
                  <div className="ml-auto flex items-center gap-2 text-[10px] font-mono text-[#525252]">
                    <span>{s.engagement_rate}% eng</span>
                    {s.follower_change_7d != null && (
                      <span className={s.follower_change_7d > 0 ? 'text-[#a3e635]' : s.follower_change_7d < 0 ? 'text-[#dc2626]' : 'text-[#525252]'}>
                        {s.follower_change_7d > 0 ? '+' : ''}{s.follower_change_7d}f
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-[#d4d4d8] leading-relaxed">{s.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <CompareDialog
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        data={compareData}
        loading={compareLoading}
        error={compareError}
      />
    </div>
  );
};


const CompareDialog = ({ open, onClose, data, loading, error }) => (
  <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
    <DialogContent className="max-w-3xl w-[95vw] glass-strong border border-[#1f1f1f] p-0 overflow-hidden">
      <DialogTitle className="sr-only">AI account comparison</DialogTitle>
      <DialogDescription className="sr-only">Head-to-head comparison of tracked Instagram accounts</DialogDescription>
      <div className="flex flex-col max-h-[85vh]">
        <div className="p-5 border-b border-[#1a1a1a] flex items-center gap-3 shrink-0">
          <GitCompareArrows className="w-4 h-4 text-white" strokeWidth={1.75} />
          <div className="flex-1">
            <div className="text-base font-semibold text-white">Head-to-head comparison</div>
            <div className="text-[11px] text-[#737373] font-mono">GPT-5.4 · cached 1h</div>
          </div>
          <button onClick={onClose} aria-label="Close" data-testid="compare-close-btn" className="text-[#737373] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-[#a1a1aa] py-6" data-testid="compare-loading">
              <Loader2 className="w-4 h-4 animate-spin" /> Comparing accounts…
            </div>
          )}
          {error && <div className="text-sm text-[#dc2626]">{error}</div>}
          {data && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
                {data.accounts.map((a) => (
                  <div key={a.username} className="p-3 bg-[#0f0f0f] border border-[#1a1a1a] rounded-md">
                    <div className="font-mono text-xs font-medium text-white mb-2 truncate">@{a.username}</div>
                    <div className="text-[10px] text-[#525252] font-mono">Followers</div>
                    <div className="font-mono text-sm text-white mb-1">{a.followers.toLocaleString()}</div>
                    <div className="text-[10px] text-[#525252] font-mono">Engagement</div>
                    <div className="font-mono text-sm text-white">{a.engagement_rate}%</div>
                  </div>
                ))}
              </div>
              <div
                data-testid="compare-content"
                className="text-sm text-[#d4d4d8] leading-relaxed space-y-3"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    (data.comparison || '').replace(
                      /\*\*(.*?)\*\*/g,
                      '<span class="block font-mono text-white uppercase tracking-wide text-[11px] mt-4 mb-1">$1</span>'
                    ),
                    { ALLOWED_TAGS: ['span', 'strong', 'em', 'br'], ALLOWED_ATTR: ['class'] }
                  )
                }}
              />
            </>
          )}
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

export default DeepDive;
