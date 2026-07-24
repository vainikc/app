import { useEffect, useState } from 'react';
import axios from 'axios';
import ForceGraph2D from 'react-force-graph-2d';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RelationshipMap = () => {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });

  useEffect(() => {
    fetchRelationships();
  }, []);

  const fetchRelationships = async () => {
    try {
      const res = await axios.get(`${API}/relationships`);
      setGraphData(res.data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const getNodeColor = (node) => {
    const colors = {
      fashion: '#2563EB',
      travel: '#06B6D4',
      tech: '#8B5CF6',
      other: '#94A3B8',
    };
    return colors[node.category] || colors.other;
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-[#F8FAFC] mb-2">
          Ties & Trails
        </h1>
        <p className="text-[#94A3B8]">Interaction patterns between accounts</p>
      </div>

      <div className="bg-[#0B101E] border border-[#1E293B] rounded-md p-6" data-testid="relationship-map">
        <div style={{ height: '600px', width: '100%' }}>
          {graphData.nodes.length > 0 ? (
            <ForceGraph2D
              graphData={graphData}
              nodeLabel="label"
              nodeColor={(node) => getNodeColor(node)}
              nodeRelSize={8}
              linkColor={() => 'rgba(37, 99, 235, 0.3)'}
              linkWidth={(link) => link.value / 5}
              backgroundColor="#0B101E"
              nodeCanvasObject={(node, ctx, globalScale) => {
                const label = node.label;
                const fontSize = 12 / globalScale;
                ctx.font = `${fontSize}px JetBrains Mono`;
                const textWidth = ctx.measureText(label).width;
                const bckgDimensions = [textWidth, fontSize].map((n) => n + fontSize * 0.4);

                ctx.fillStyle = getNodeColor(node);
                ctx.beginPath();
                ctx.arc(node.x, node.y, 6, 0, 2 * Math.PI, false);
                ctx.fill();

                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#F8FAFC';
                ctx.fillText(label, node.x, node.y + 12);
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[#94A3B8]">Loading relationship data...</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-4 justify-center">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-[#2563EB]"></div>
            <span className="text-sm text-[#94A3B8]">Fashion</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-[#06B6D4]"></div>
            <span className="text-sm text-[#94A3B8]">Travel</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-[#8B5CF6]"></div>
            <span className="text-sm text-[#94A3B8]">Tech</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-[#94A3B8]"></div>
            <span className="text-sm text-[#94A3B8]">Other</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RelationshipMap;