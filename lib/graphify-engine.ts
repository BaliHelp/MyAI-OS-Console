/**
 * Graphify Knowledge Engine
 * Extracts Entity Nodes and Relationship Edges from structured payloads & text
 * to form a Knowledge Graph that optimizes AI RAG token efficiency.
 */

export interface GraphNode {
  id: string;
  label: string;
  type: "USER" | "DOCUMENT" | "PASSPORT" | "VISA" | "TRANSACTION" | "EMAIL" | "CHAT" | "APP";
  properties: Record<string, any>;
  client_app_id?: string | null;
}

export interface GraphEdge {
  id: string;
  source: string; // source node id
  target: string; // target node id
  relation: "HAS_DOCUMENT" | "APPLIED_FOR" | "PAID_FOR" | "SENT_EMAIL" | "GENERATED_CHAT" | "BELONGS_TO";
  weight: number;
}

export interface ExtractedGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Extract Entity-Relationship graph from a Data Center record
 */
export function extractGraphFromRecord(record: {
  id: string;
  client_app_id?: string | null;
  app_name?: string;
  source_type: string;
  document_type?: string | null;
  extracted_data?: any;
  raw_text?: string | null;
  created_at: string;
}): ExtractedGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const data = record.extracted_data || {};

  // 1. App Node
  const appId = record.client_app_id || "internal";
  const appNodeId = `app_${appId}`;
  nodes.push({
    id: appNodeId,
    label: record.app_name || "Internal App",
    type: "APP",
    properties: { client_app_id: record.client_app_id },
    client_app_id: record.client_app_id,
  });

  // 2. Document/Record Node
  const recordNodeId = `record_${record.id}`;
  nodes.push({
    id: recordNodeId,
    label: `${record.document_type || record.source_type} (${record.id.slice(0, 6)})`,
    type: record.source_type.includes("chat") ? "CHAT" : "DOCUMENT",
    properties: {
      source_type: record.source_type,
      document_type: record.document_type,
      created_at: record.created_at,
    },
    client_app_id: record.client_app_id,
  });

  edges.push({
    id: `edge_${appNodeId}_${recordNodeId}`,
    source: appNodeId,
    target: recordNodeId,
    relation: "BELONGS_TO",
    weight: 1.0,
  });

  // 3. User Entity Node (if name/userId present)
  const fullName = data.fullName || data.full_name || data.passengerName || data.primary_name;
  if (fullName && typeof fullName === "string" && fullName.trim()) {
    const userNodeId = `user_${fullName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    nodes.push({
      id: userNodeId,
      label: fullName.trim(),
      type: "USER",
      properties: { name: fullName.trim(), nationality: data.nationality || data.issuing_country },
      client_app_id: record.client_app_id,
    });

    edges.push({
      id: `edge_${userNodeId}_${recordNodeId}`,
      source: userNodeId,
      target: recordNodeId,
      relation: "HAS_DOCUMENT",
      weight: 1.0,
    });
  }

  // 4. Passport / ID Node (if passportNumber present)
  const passportNum = data.passportNumber || data.document_number;
  if (passportNum && typeof passportNum === "string" && passportNum.trim()) {
    const passportNodeId = `passport_${passportNum.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    nodes.push({
      id: passportNodeId,
      label: `Passport: ${passportNum.trim()}`,
      type: "PASSPORT",
      properties: {
        number: passportNum.trim(),
        country: data.issuingCountry || data.nationality,
        expiry: data.expiryDate,
      },
      client_app_id: record.client_app_id,
    });

    edges.push({
      id: `edge_${recordNodeId}_${passportNodeId}`,
      source: recordNodeId,
      target: passportNodeId,
      relation: "HAS_DOCUMENT",
      weight: 1.0,
    });
  }

  // 5. Visa Node (if visa_type present)
  const visaType = data.visaType || data.visa_type;
  if (visaType && typeof visaType === "string" && visaType.trim()) {
    const visaNodeId = `visa_${visaType.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    nodes.push({
      id: visaNodeId,
      label: `Visa: ${visaType.trim()}`,
      type: "VISA",
      properties: { type: visaType.trim() },
      client_app_id: record.client_app_id,
    });

    edges.push({
      id: `edge_${recordNodeId}_${visaNodeId}`,
      source: recordNodeId,
      target: visaNodeId,
      relation: "APPLIED_FOR",
      weight: 1.0,
    });
  }

  return { nodes, edges };
}
