Here are 10 TypeScript coding challenges, arranged from easy to hard. They focus on problem-solving, algorithms, and real-world software engineering.

## Level 1 — Beginner

1\. Array Chunking

Write a function that splits an array into smaller arrays of a specified size.

```
chunk([1, 2, 3, 4, 5, 6, 7], 3);

// Expected:
// [[1, 2, 3], [4, 5, 6], [7]]
```

2\. Remove Duplicates

Remove duplicate values without using `Set`.

```
removeDuplicates([1, 2, 2, 3, 4, 4, 5]);

// Expected: [1, 2, 3, 4, 5]
```

3\. Character Frequency

Count how many times each character appears in a string.

```
charFrequency("typescript");

// Expected:
// { t: 2, y: 1, p: 1, e: 1, s: 1, c: 1, r: 1, i: 1 }
```

## Level 2 — Intermediate

4\. Group By

Implement your own `groupBy` function.

```
const users = [
  { name: "John", role: "admin" },
  { name: "Jane", role: "user" },
  { name: "Bob", role: "admin" },
];

groupBy(users, "role");

// Expected:
// {
//   admin: [{ name: "John", role: "admin" }, { name: "Bob", role: "admin" }],
//   user: [{ name: "Jane", role: "user" }]
// }
```

5\. Deep Flatten Array

Flatten a nested array of unlimited depth.

```
deepFlatten([1, [2, [3, [4]], 5]]);

// Expected: [1, 2, 3, 4, 5]
```

6\. Implement Promise.all

Implement your own version of `Promise.all`.

```
myPromiseAll([
  Promise.resolve(1),
  Promise.resolve(2),
  Promise.resolve(3),
]);

// Expected: Promise resolving to [1, 2, 3]
```

Requirements:

- Preserve the original order.
- Reject immediately if one promise rejects.
- Support regular values as well as promises.

## Level 3 — Advanced

7\. Implement Debounce

Create a generic debounce function.

```
const search = debounce((query: string) => {
  console.log(query);
}, 500);

search("hel");
search("hello");
search("hello world");

// Only execute the last call after 500ms.
```

8\. LRU Cache

Implement a Least Recently Used cache.

```
const cache = new LRUCache<number, string>(2);

cache.put(1, "A");
cache.put(2, "B");

cache.get(1); // A

cache.put(3, "C");

cache.get(2); // undefined
```

Requirements:

- `get()` and `put()` should run in O(1).
- Support configurable capacity.
- Automatically evict the least recently used item.

9\. Retry Mechanism

Implement an asynchronous retry function.

```
await retry(
  async () => fetchData(),
  3,
  1000
);
```

Requirements:

- Retry up to 3 times after failures.
- Wait 1 second between attempts.
- Return the successful result.
- Throw the final error if all attempts fail.

## Level 4 — Real-world challenge

10\. Build a Task Queue

Implement a task queue that executes asynchronous jobs with limited concurrency.

```
const queue = new TaskQueue(2);

queue.add(() => fetchUser(1));
queue.add(() => fetchUser(2));
queue.add(() => fetchUser(3));
queue.add(() => fetchUser(4));

await queue.run();
```

Requirements:

- Maximum 2 concurrent tasks.
- Execute all tasks.
- Preserve result order.
- Handle failed tasks without stopping the entire queue.

## How I recommend practicing

| Rule               | Requirement                       |
| ------------------ | --------------------------------- |
| Language           | TypeScript                        |
| External libraries | Not allowed                       |
| Type safety        | Avoid `any`                       |
| Testing            | Write test cases                  |
| Optimization       | Analyze time and space complexity |

My recommendation: Start with problem 1 and work your way up. Don't look for solutions immediately.

You can send me your TypeScript code after each problem. I'll review it like a senior engineer, checking correctness, edge cases, performance, and code quality.
