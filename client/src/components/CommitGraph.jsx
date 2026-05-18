import { useMemo } from "react";

export default function CommitGraph({ commits, parents, branches }) {
  const layout = useMemo(() => {
    const laneByBranch = new Map();
    branches.forEach((branch, index) => {
      laneByBranch.set(branch.id, index);
    });

    const laneSpacing = 120;
    const xStart = 120;
    const yStart = 70;
    const yStep = 64;

    const ordered = [...commits].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    const nodes = ordered.map((commit, index) => {
      const lane = laneByBranch.get(commit.branch_id) ?? 0;
      return {
        ...commit,
        lane,
        x: xStart + lane * laneSpacing,
        y: yStart + index * yStep
      };
    });

    const nodeById = new Map(nodes.map((node) => [node.id, node]));

    const edges = parents
      .map((edge) => {
        const from = nodeById.get(edge.commit_id);
        const to = nodeById.get(edge.parent_commit_id);
        if (!from || !to) {
          return null;
        }
        return { from, to };
      })
      .filter(Boolean);

    const headCommitIds = new Set(
      branches.map((branch) => branch.head_commit_id).filter(Boolean)
    );

    return {
      nodes,
      edges,
      headCommitIds,
      laneSpacing,
      xStart,
      width: Math.max(420, 160 + branches.length * laneSpacing),
      height: Math.max(280, 120 + nodes.length * yStep)
    };
  }, [commits, parents, branches]);

  if (commits.length === 0) {
    return <div className="panel p-5 text-sm text-mist">No commits to show yet.</div>;
  }

  return (
    <div className="panel overflow-auto p-5">
      <svg width={layout.width} height={layout.height} className="text-mist">
        {branches.map((branch, index) => (
          <g key={branch.id}>
            <line
              x1={layout.xStart + index * layout.laneSpacing}
              y1={40}
              x2={layout.xStart + index * layout.laneSpacing}
              y2={layout.height - 40}
              stroke="#30363d"
              strokeDasharray="4 6"
              strokeWidth="1"
            />
            <text
              x={layout.xStart + index * layout.laneSpacing}
              y={30}
              textAnchor="middle"
              fontSize="11"
              fill="#8b949e"
              fontFamily="JetBrains Mono"
            >
              {branch.name}
            </text>
          </g>
        ))}

        {layout.edges.map((edge, index) => (
          <line
            key={index}
            x1={edge.from.x}
            y1={edge.from.y}
            x2={edge.to.x}
            y2={edge.to.y}
            stroke={edge.from.is_merge ? "#d29922" : "#2f81f7"}
            strokeWidth="2"
            strokeLinecap="round"
          />
        ))}

        {layout.nodes.map((node) => (
          <g key={node.id}>
            <circle
              cx={node.x}
              cy={node.y}
              r={7}
              fill={node.is_merge ? "#d29922" : "#2f81f7"}
              stroke={layout.headCommitIds.has(node.id) ? "#3fb950" : "#161b22"}
              strokeWidth="3"
            />
            <text
              x={node.x + 16}
              y={node.y + 4}
              fontSize="11"
              fill="#c9d1d9"
              fontFamily="JetBrains Mono"
            >
              {node.message.slice(0, 22)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
