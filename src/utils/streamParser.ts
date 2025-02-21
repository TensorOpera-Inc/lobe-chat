import { get, set } from 'lodash-es';

type Operation = 'append' | 'replace' | 'remove';

type Value = string; // TODO 需要支持多种类型

type Part = string;

interface Chunk {
  operation: Operation;
  part: Part;
  value: Value;
}

interface Message {
  content: {
    parts: string[];
  };
  createdAt: string;
  id: string;
  metadata: Record<string, unknown>;
  role: 'user' | 'assistant' | 'system';
}

export type ChunkTransformer = (chunk: Chunk, message: Message) => Message;

function defaultChunkTransformer(chunk: Chunk, message: Message): Message {
  switch (chunk.operation) {
    case 'append': {
      set(message, chunk.part, get(message, chunk.part) + chunk.value);
      break;
    }
    case 'replace': {
      set(message, chunk.part, chunk.value);
      break;
    }
    case 'remove': {
      set(message, chunk.part, null);
      break;
    }
  }

  return message;
}

/**
 * 
 * @param stream 
 * @param options 
 * @returns 
 * @description
```mermaid
flowchart TD
    A[开始] --> B[初始化 message]
    B --> C[触发初始 onMessageUpdate]
    C --> D[获取 stream reader]
    D --> E{读取下一个 chunk}
    E -->|有数据| F[使用 transformer 转换 message]
    F --> G[触发 onMessageUpdate]
    G --> E
    E -->|结束| H[返回最终 message]
    H --> I[结束]
```
 */
export async function streamParser(
  stream: ReadableStream<Chunk>,
  options?: {
    chunkTransformer?: ChunkTransformer;
    onMessageUpdate?: (message: Message) => void;
  },
): Promise<Message> {
  const reader = stream.getReader();
  let message: Message = {
    content: {
      parts: [],
    },
    createdAt: '',
    id: '',
    metadata: {},
    role: 'assistant',
  };

  options?.onMessageUpdate?.(message);

  const transformer = options?.chunkTransformer ?? defaultChunkTransformer;

  let done = false;

  while (!done) {
    const { done: doneReading, value } = await reader.read();
    done = doneReading;
    if (value) {
      message = transformer(value, message);
      options?.onMessageUpdate?.(message);
    }
  }

  return message;
}

export async function defineStreamParser(parser: ChunkTransformer) {
  return (
    stream: ReadableStream<Chunk>,
    options: {
      chunkTransformer: ChunkTransformer;
      onMessageUpdate?: (message: Message) => void;
    },
  ) =>
    streamParser(stream, {
      chunkTransformer: parser ?? options.chunkTransformer ?? defaultChunkTransformer,
      onMessageUpdate: options.onMessageUpdate,
    });
}
