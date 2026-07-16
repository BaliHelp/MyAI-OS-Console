import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import fs from "fs";
import path from "path";

const dbPath = path.resolve(process.cwd(), "db.json");

function readLocalDb() {
  if (fs.existsSync(dbPath)) {
    return JSON.parse(fs.readFileSync(dbPath, "utf8"));
  }
  return {};
}

function writeLocalDb(data: any) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), "utf8");
}

export async function GET(req: NextRequest) {
  if (!supabaseAdmin) {
    const db = readLocalDb();
    const fields = db.aiFields || [];
    const specs = db.fieldSpecs || [];

    const response = fields.map((f: any) => {
      const spec = specs.find((s: any) => s.field_key === f.field_key) || {
        field_key: f.field_key,
        system_prompt: "",
        output_schema: null,
        example_input_description: null,
        example_output: null
      };
      return {
        ...spec,
        display_name: f.display_name
      };
    });

    return NextResponse.json(response);
  }

  try {
    const [fieldsRes, specsRes] = await Promise.all([
      supabaseAdmin.from("gw_ai_fields").select("field_key, display_name"),
      supabaseAdmin.from("gw_field_specs").select("*")
    ]);

    if (fieldsRes.error) throw new Error(fieldsRes.error.message);
    if (specsRes.error) throw new Error(specsRes.error.message);

    const specsData = specsRes.data || [];
    const response = (fieldsRes.data || []).map((f) => {
      const spec = specsData.find((s) => s.field_key === f.field_key) || {
        field_key: f.field_key,
        system_prompt: "",
        output_schema: null,
        example_input_description: null,
        example_output: null
      };
      return {
        ...spec,
        display_name: f.display_name
      };
    });

    return NextResponse.json(response);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { action, field_key, system_prompt, output_schema, example_input_description, example_output } = body;

  if (!field_key) {
    return NextResponse.json({ error: "field_key is required" }, { status: 400 });
  }

  if (action !== "update_spec") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Parse output_schema if it's a string representation of JSON
  let parsedSchema = output_schema;
  if (typeof output_schema === "string" && output_schema.trim() !== "") {
    try {
      parsedSchema = JSON.parse(output_schema);
    } catch (e: any) {
      return NextResponse.json({ error: `Invalid JSON format in output_schema: ${e.message}` }, { status: 400 });
    }
  } else if (typeof output_schema === "string" && output_schema.trim() === "") {
    parsedSchema = null;
  }

  // Parse example_output if string
  let parsedExampleOutput = example_output;
  if (typeof example_output === "string" && example_output.trim() !== "") {
    try {
      parsedExampleOutput = JSON.parse(example_output);
    } catch (e: any) {
      return NextResponse.json({ error: `Invalid JSON format in example_output: ${e.message}` }, { status: 400 });
    }
  } else if (typeof example_output === "string" && example_output.trim() === "") {
    parsedExampleOutput = null;
  }

  if (!supabaseAdmin) {
    const db = readLocalDb();
    if (!db.fieldSpecs) db.fieldSpecs = [];

    const existingIdx = db.fieldSpecs.findIndex((s: any) => s.field_key === field_key);
    const updatedSpec = {
      field_key,
      system_prompt: system_prompt || "",
      output_schema: parsedSchema,
      example_input_description: example_input_description || null,
      example_output: parsedExampleOutput,
      updated_at: new Date().toISOString()
    };

    if (existingIdx !== -1) {
      db.fieldSpecs[existingIdx] = updatedSpec;
    } else {
      db.fieldSpecs.push(updatedSpec);
    }

    writeLocalDb(db);
    return NextResponse.json(updatedSpec);
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("gw_field_specs")
      .upsert({
        field_key,
        system_prompt: system_prompt || "",
        output_schema: parsedSchema,
        example_input_description: example_input_description || null,
        example_output: parsedExampleOutput,
        updated_at: new Date().toISOString()
      }, { onConflict: "field_key" })
      .select();

    if (error) throw new Error(error.message);
    return NextResponse.json(data?.[0]);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
