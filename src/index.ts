#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosInstance, AxiosError } from "axios";

// Type definitions for n8n API responses
interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  tags?: Array<{ id: string; name: string }>;
}

interface N8nExecution {
  id: string;
  finished: boolean;
  mode: string;
  retryOf?: string;
  retrySuccessId?: string;
  startedAt: string;
  stoppedAt?: string;
  workflowId: string;
  waitTill?: string;
  status?: "success" | "error" | "waiting" | "running";
  data?: {
    resultData?: {
      error?: {
        message: string;
        stack?: string;
      };
    };
  };
}

interface N8nWorkflowDetail extends N8nWorkflow {
  nodes: Array<any>;
  connections: Record<string, any>;
  settings?: Record<string, any>;
  staticData?: Record<string, any>;
}

class N8nMcpServer {
  private server: Server;
  private axiosInstance: AxiosInstance;
  private n8nUrl: string;
  private apiKey: string;

  constructor() {
    // Get configuration from environment variables
    this.n8nUrl = process.env.N8N_URL || "";
    this.apiKey = process.env.N8N_API_KEY || "";

    if (!this.n8nUrl) {
      throw new Error("N8N_URL environment variable is required");
    }

    if (!this.apiKey) {
      throw new Error("N8N_API_KEY environment variable is required");
    }

    // Remove trailing slash from URL if present
    this.n8nUrl = this.n8nUrl.replace(/\/$/, "");

    // Initialize axios instance with n8n API configuration
    this.axiosInstance = axios.create({
      baseURL: `${this.n8nUrl}/api/v1`,
      headers: {
        "X-N8N-API-KEY": this.apiKey,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    // Initialize MCP server
    this.server = new Server(
      {
        name: "n8n-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "list_workflows",
          description:
            "Get all workflows with their IDs, names, and active status. Returns a list of all workflows in your n8n instance.",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
        {
          name: "get_workflow",
          description:
            "Fetch the complete JSON definition of a specific workflow by ID. This includes all nodes, connections, and settings.",
          inputSchema: {
            type: "object",
            properties: {
              workflow_id: {
                type: "string",
                description: "The ID of the workflow to fetch",
              },
            },
            required: ["workflow_id"],
          },
        },
        {
          name: "get_executions",
          description:
            "Get recent execution history for a workflow. Returns execution status, timestamps, and error messages if any.",
          inputSchema: {
            type: "object",
            properties: {
              workflow_id: {
                type: "string",
                description: "The ID of the workflow to get executions for",
              },
              limit: {
                type: "number",
                description:
                  "Maximum number of executions to return (default: 10, max: 100)",
                default: 10,
              },
            },
            required: ["workflow_id"],
          },
        },
        {
          name: "trigger_workflow",
          description:
            "Manually trigger a workflow execution. Optionally provide input data to pass to the workflow.",
          inputSchema: {
            type: "object",
            properties: {
              workflow_id: {
                type: "string",
                description: "The ID of the workflow to trigger",
              },
              data: {
                type: "object",
                description:
                  "Optional data to pass to the workflow trigger (must be valid JSON)",
              },
            },
            required: ["workflow_id"],
          },
        },
      ],
    }));

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case "list_workflows":
            return await this.listWorkflows();

          case "get_workflow":
            if (!args?.workflow_id) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "workflow_id is required"
              );
            }
            return await this.getWorkflow(args.workflow_id as string);

          case "get_executions":
            if (!args?.workflow_id) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "workflow_id is required"
              );
            }
            return await this.getExecutions(
              args.workflow_id as string,
              args?.limit as number | undefined
            );

          case "trigger_workflow":
            if (!args?.workflow_id) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "workflow_id is required"
              );
            }
            return await this.triggerWorkflow(
              args.workflow_id as string,
              args?.data as Record<string, any> | undefined
            );

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        return this.handleError(error);
      }
    });
  }

  private async listWorkflows() {
    try {
      const response = await this.axiosInstance.get<{ data: N8nWorkflow[] }>(
        "/workflows"
      );

      const workflows = response.data.data.map((workflow) => ({
        id: workflow.id,
        name: workflow.name,
        active: workflow.active,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
        tags: workflow.tags,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                count: workflows.length,
                workflows,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      throw this.handleAxiosError(error, "Failed to list workflows");
    }
  }

  private async getWorkflow(workflowId: string) {
    try {
      const response = await this.axiosInstance.get<{ data: N8nWorkflowDetail }>(
        `/workflows/${workflowId}`
      );

      const workflow = response.data.data;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                workflow: {
                  id: workflow.id,
                  name: workflow.name,
                  active: workflow.active,
                  nodes: workflow.nodes,
                  connections: workflow.connections,
                  settings: workflow.settings,
                  staticData: workflow.staticData,
                  tags: workflow.tags,
                  createdAt: workflow.createdAt,
                  updatedAt: workflow.updatedAt,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      throw this.handleAxiosError(error, `Failed to get workflow ${workflowId}`);
    }
  }

  private async getExecutions(workflowId: string, limit: number = 10) {
    try {
      // Validate and cap the limit
      const validLimit = Math.min(Math.max(1, limit || 10), 100);

      const response = await this.axiosInstance.get<{ data: N8nExecution[] }>(
        `/executions`,
        {
          params: {
            workflowId,
            limit: validLimit,
          },
        }
      );

      const executions = response.data.data.map((execution) => ({
        id: execution.id,
        workflowId: execution.workflowId,
        finished: execution.finished,
        mode: execution.mode,
        startedAt: execution.startedAt,
        stoppedAt: execution.stoppedAt,
        status: this.determineExecutionStatus(execution),
        error: execution.data?.resultData?.error?.message || null,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                workflowId,
                count: executions.length,
                executions,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      throw this.handleAxiosError(
        error,
        `Failed to get executions for workflow ${workflowId}`
      );
    }
  }

  private async triggerWorkflow(
    workflowId: string,
    data?: Record<string, any>
  ) {
    try {
      const response = await this.axiosInstance.post<{ data: any }>(
        `/workflows/${workflowId}/activate`,
        data || {}
      );

      // Check if workflow is active, if not we need to use test execution
      const workflowResponse = await this.axiosInstance.get<{
        data: N8nWorkflow;
      }>(`/workflows/${workflowId}`);

      let executionId: string | undefined;

      if (workflowResponse.data.data.active) {
        // For active workflows, trigger via webhook or test
        // Note: The actual trigger method depends on how the workflow is configured
        // For manual triggers, we can use the test endpoint
        const testResponse = await this.axiosInstance.post<{
          data: { executionId: string };
        }>(`/workflows/${workflowId}/test`, {
          workflowData: workflowResponse.data.data,
          runData: data,
        });
        executionId = testResponse.data.data.executionId;
      } else {
        // For inactive workflows, we can still test them
        const testResponse = await this.axiosInstance.post<{
          data: { executionId: string };
        }>(`/workflows/${workflowId}/test`, {
          workflowData: workflowResponse.data.data,
          runData: data,
        });
        executionId = testResponse.data.data.executionId;
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                message: "Workflow triggered successfully",
                workflowId,
                executionId,
                workflowActive: workflowResponse.data.data.active,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      throw this.handleAxiosError(
        error,
        `Failed to trigger workflow ${workflowId}`
      );
    }
  }

  private determineExecutionStatus(
    execution: N8nExecution
  ): "success" | "error" | "waiting" | "running" {
    if (execution.waitTill) return "waiting";
    if (!execution.finished) return "running";
    if (execution.data?.resultData?.error) return "error";
    if (execution.finished && execution.stoppedAt) return "success";
    return "error";
  }

  private handleAxiosError(error: unknown, context: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const message = axiosError.response?.data
        ? JSON.stringify(axiosError.response.data)
        : axiosError.message;

      if (status === 401 || status === 403) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Authentication failed: ${message}. Please check your N8N_API_KEY.`
        );
      }

      if (status === 404) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Resource not found: ${message}`
        );
      }

      throw new McpError(
        ErrorCode.InternalError,
        `${context}: ${message}`
      );
    }

    throw new McpError(
      ErrorCode.InternalError,
      `${context}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  private handleError(error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: false,
              error: errorMessage,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("n8n MCP Server running on stdio");
  }
}

// Main execution
const server = new N8nMcpServer();
server.run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
