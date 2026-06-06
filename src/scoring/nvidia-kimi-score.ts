import axios from 'axios';
import { Readable } from 'node:stream';
import { AiLeadScore, CanonicalLead } from '../leads/types';
import { buildLeadScoringPrompt } from './prompts';

type NvidiaKimiResponse = {
  results: Array<AiLeadScore & { id: string }>;
};

type ChatCompletionChunk = {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
};

const defaultInvokeUrl = 'https://integrate.api.nvidia.com/v1/chat/completions';
const defaultModel = 'moonshotai/kimi-k2.6';

export class NvidiaKimiScorer {
  constructor(
    private readonly apiKey: string,
    private readonly model = defaultModel,
    private readonly invokeUrl = defaultInvokeUrl
  ) {}

  async scoreLeads(leads: CanonicalLead[]): Promise<Map<string, AiLeadScore>> {
    if (leads.length === 0) return new Map();

    const prompt = buildLeadScoringPrompt(leads);
    const stream = true;

    const response = await axios.post(
      this.invokeUrl,
      {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: prompt.system,
          },
          {
            role: 'user',
            content: prompt.prompt,
          },
        ],
        max_tokens: 16384,
        temperature: 1.0,
        top_p: 1.0,
        stream,
        chat_template_kwargs: { thinking: true },
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: stream ? 'text/event-stream' : 'application/json',
        },
        responseType: stream ? 'stream' : 'json',
      }
    );

    const text = await readNvidiaEventStream(response.data);
    const parsed = parseNvidiaKimiScoringResponse(text);
    const map = new Map<string, AiLeadScore>();

    for (const result of parsed.results ?? []) {
      const { id, ...score } = result;
      map.set(id, score);
    }

    return map;
  }
}

export function parseNvidiaKimiScoringResponse(
  text: string
): NvidiaKimiResponse {
  const json = extractJson(text);

  if (!json) {
    throw new Error('NVIDIA Kimi response did not contain JSON content');
  }

  return JSON.parse(json) as NvidiaKimiResponse;
}

export function formatNvidiaKimiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const statusText = error.response?.statusText;

    if (status) {
      return ['NVIDIA Kimi scoring failed:', status, statusText]
        .filter(Boolean)
        .join(' ');
    }

    return `NVIDIA Kimi scoring failed: ${error.message}`;
  }

  if (error instanceof Error) {
    return `NVIDIA Kimi scoring failed: ${error.message}`;
  }

  return `NVIDIA Kimi scoring failed: ${String(error)}`;
}

async function readNvidiaEventStream(stream: Readable): Promise<string> {
  let buffered = '';
  let content = '';

  for await (const chunk of stream) {
    buffered += chunk.toString();
    const events = buffered.split('\n\n');
    buffered = events.pop() ?? '';

    for (const event of events) {
      content += parseEventContent(event);
    }
  }

  if (buffered.trim()) {
    content += parseEventContent(buffered);
  }

  return content;
}

function parseEventContent(event: string): string {
  return event
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trim())
    .filter((line) => line && line !== '[DONE]')
    .map((line) => {
      const parsed = JSON.parse(line) as ChatCompletionChunk;
      return parsed.choices?.[0]?.delta?.content ?? '';
    })
    .join('');
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  if (fenced) {
    return fenced[1].trim();
  }

  return trimmed;
}
