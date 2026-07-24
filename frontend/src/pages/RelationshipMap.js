import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import ForceGraph2D from 'react-force-graph-2d';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RelationshipMap = () => {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ width: 800, height: 600 });

  useEffect(() => {
    fetch();
    const handleResize = () => {
      if (containerRef.current) {
        setDims({
          width: containerRef.current.clientWidth,
          height: 600
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetch = async () => {
    try {
      const res = await axios.get(`${API}/relationships`);
      setGraphData(res.data);
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  const getNodeColor = (node) => {
    const palette = {
      personal: '#d4a656',
      unknown: '#6b6660',
    };
    if (palette[node.category]) return palette[node.category];
    // Hash-based color for other categories
    let hash = 0;
    const cat = String(node.category || 'x');
    for (let i = 0; i < cat.length; i++) hash = cat.charCodeAt(i) + ((hash << 5) - hash);
    const colors = ['#d4a656', '#7d9c60', '#a87433', '#c9c5be', '#8b5f2b', '#5d7a4a'];
    return colors[Math.abs(hash) % colors.length];
  };

  const categories = [...new Set(graphData.nodes.map((n) => n.category))];

  return (
    <div className="p-10 max-w-[1600px]">
      <div className="mb-10">
        <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#d4a656] mb-3">
          Network Analysis
        </div>
        <h1 className="font-heading text-5xl sm:text-6xl font-semibold tracking-tight text-[#e8e6e1] mb-2">
          Ties &amp; Trails
        </h1>
        <p className="text-[#8a857e]">Connections between tracked profiles by category and interest.</p>
        <div className="divider-ornate mt-6 max-w-md"></div>
      </div>

      <div className="card-detective rounded-md p-6" data-testid="relationship-map">
        <div ref={containerRef} style={{ height: '600px', width: '100%', background: '#0a0a0a' }} className="rounded-sm">
          {loading ? (
            <div className="flex items-center justify-center h-full text-[#6b6660]">Loading network...</div>
          ) : graphData.nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="font-heading text-2xl text-[#8a857e] mb-2">No connections yet</div>
                <p className="text-sm text-[#6b6660]">Track multiple profiles to reveal the web.</p>
              </div>
            </div>
          ) : (
            <ForceGraph2D
              graphData={graphData}
              width={dims.width - 48}
              height={600}
              backgroundColor="#0a0a0a"
              nodeLabel={(n) => `@${n.label} · ${n.followers?.toLocaleString() || 0} followers`}
              linkColor={() => 'rgba(212, 166, 86, 0.25)'}
              linkWidth={(l) => Math.max(1, l.value / 3)}
              nodeCanvasObject={(node, ctx, globalScale) => {
                const label = `@${node.label}`;
                const fontSize = 11 / globalScale;
                const radius = Math.max(6, Math.min(18, Math.log10((node.followers || 1) + 10) * 3));

                ctx.beginPath();
                ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
                ctx.fillStyle = getNodeColor(node);
                ctx.fill();
                if (node.verified) {
                  ctx.strokeStyle = '#e6d09e';
                  ctx.lineWidth = 2 / globalScale;
                  ctx.stroke();
                }

                ctx.font = `${fontSize}px 'JetBrains Mono'`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillStyle = '#e8e6e1';
                ctx.fillText(label, node.x, node.y + radius + 2);
              }}
              nodePointerAreaPaint={(node, color, ctx) => {
                const radius = Math.max(6, Math.min(18, Math.log10((node.followers || 1) + 10) * 3));
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
                ctx.fillStyle = color;
                ctx.fill();
              }}
            />
          )}
        </div>

        {categories.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-3 pt-4 border-t border-[#1f1f1f]">
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#6b6660] self-center">Legend</div>
            {categories.map((cat) => (
              <div key={cat} className="flex items-center gap-2 px-3 py-1 bg-[#141414] border border-[#1f1f1f] rounded-full">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getNodeColor({ category: cat }) }}
                />
                <span className="text-xs font-mono text-[#c9c5be] capitalize">{cat}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RelationshipMap;
