import { streamParser } from './streamParser';

describe('streamParser', () => {
  it('应该正确处理不同类型的操作', async () => {
    // 创建模拟的数据块
    const chunks = [
      {
        operation: 'replace',
        part: 'content.parts[0]',
        value: 'Hello',
      },
      {
        operation: 'append',
        part: 'content.parts[0]',
        value: ' World',
      },
      {
        operation: 'replace',
        part: 'content.parts[1]',
        value: 'Part2 Hello World',
      },
      {
        operation: 'replace',
        part: 'id',
        value: 'test-id',
      },
      {
        operation: 'replace',
        part: 'role',
        value: 'assistant',
      },
    ];

    // 创建模拟的 ReadableStream
    const stream = new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(chunk));
        controller.close();
      },
    });

    // 执行 streamParser
    const result = await streamParser(stream);

    // 验证结果
    expect(result).toMatchInlineSnapshot(`
      {
        "content": {
          "parts": [
            "Hello World",
            "Part2 Hello World",
          ],
        },
        "createdAt": "",
        "id": "test-id",
        "metadata": {},
        "role": "assistant",
      }
    `);
  });

  it('应该处理空流', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.close();
      },
    });

    const result = await streamParser(stream);

    expect(result).toMatchInlineSnapshot(`
      {
        "content": {
          "parts": [],
        },
        "createdAt": "",
        "id": "",
        "metadata": {},
        "role": "assistant",
      }
    `);
  });

  it('应该正确触发消息更新回调', async () => {
    const chunks = [
      {
        operation: 'replace',
        part: 'content.parts[0]',
        value: 'Hello',
      },
      {
        operation: 'append',
        part: 'content.parts[0]',
        value: ' World',
      },
    ];

    const stream = new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(chunk));
        controller.close();
      },
    });

    const updates: string[] = [];

    await streamParser(stream, {
      onMessageUpdate: (message) => {
        updates.push(JSON.stringify(message)); // 保存每次更新的消息副本
      },
    });

    // 验证更新次数（初始状态 + 两次更新）
    expect(updates.length).toBe(3);

    expect(updates).toMatchInlineSnapshot(`
      [
        "{"content":{"parts":[]},"createdAt":"","id":"","metadata":{},"role":"assistant"}",
        "{"content":{"parts":["Hello"]},"createdAt":"","id":"","metadata":{},"role":"assistant"}",
        "{"content":{"parts":["Hello World"]},"createdAt":"","id":"","metadata":{},"role":"assistant"}",
      ]
    `);
  });
});
