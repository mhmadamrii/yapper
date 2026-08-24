function longestOfSubstring(s: string): number {
  const chars = new Set<string | undefined>();

  let left = 0;
  let answer = 0;

  for (let right = 0; right < s.length; right++) {
    while (chars.has(s[right])) {
      chars.delete(s[left]);
      left++;
    }

    chars.add(s[right]);

    const windowLen = right - left + 1;

    console.log('the answer', answer);
    console.log('not using math max', windowLen);

    answer = Math.max(answer, windowLen);
  }

  return answer;
}

function selectionSort(arr: number[]): number[] {
  const l = arr.length;

  for (let i = 0; i < l - 1; i++) {
    let minIdx = i;

    for (let j = 0; j < l; j++) {
      if (arr[j] < arr[minIdx]) {
        minIdx = j;
      }
    }

    [arr[i], arr[minIdx]] = [arr[minIdx], arr[i]];
  }

  return arr;
}

function findDuplicate(arr: number[]): number[] {
  const ids = new Set<number>();
  const duplicates: number[] = [];

  for (const a of arr) {
    if (ids.has(a)) {
      duplicates.push(a);
    } else {
      ids.add(a);
    }
  }

  return duplicates;
}

type Result = {
  inBoth: string[];
  onlyFirst: string[];
  onlySecond: string[];
};

function warehouseInventoryMerge(a: string[], b: string[]): Result {
  const inventoryA = new Set(a);
  const inventoryB = new Set(b);

  let result: Result = {
    inBoth: [],
    onlyFirst: [],
    onlySecond: [],
  };

  for (const i of a) {
    if (inventoryB.has(i)) {
      result.inBoth.push(i);
    }

    if (!inventoryB.has(i)) {
      result.onlyFirst.push(i);
    }
  }

  for (const e of b) {
    if (!inventoryA.has(e)) {
      result.onlySecond.push(e);
    }
  }

  // need to remove duplicate of result
  return {
    inBoth: [...new Set(result.inBoth)],
    onlyFirst: [...new Set(result.onlyFirst)],
    onlySecond: [...new Set(result.onlySecond)],
  };
}

function longestWinningStreak(arr: string[]): number {
  if (arr.length == 0) return 0;

  let ws: number = 0;

  for (const w of arr) {
    if (w == 'W') {
      ws += 1;
    }
  }

  return ws;
}

function conflictDetector(seat: number[][]): boolean {
  let isConflict = false;
  for (let i = 0; i < seat.length - 1; i++) {
    for (let j = 0; j < seat.length - 1; j++) {
      if (seat[i][1] > seat[j + 1][0]) {
        isConflict = true;
      }
    }
  }

  return isConflict;
}

function anagramGrouping(arr: string[]) {
  let groupings = {};

  console.log(groupings);

  for (const s of arr) {
    console.log(s.split(' '));
  }
}

function fn(arr: number[]): number | undefined {
  return arr[Math.round((arr.length - 1) / 2)];
}

function qSort(arr: number[]): number[] {
  if (arr.length <= 1) {
    return arr;
  }

  // get the pivot (the middle element of array)
  const middle = arr[Math.round((arr.length - 1) / 2)];
  const left = [];
  const right = [];

  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] < middle) {
      left.push(arr[i]);
    } else {
      right.push(arr[i]);
    }
  }

  console.log({ left, right });

  return [...qSort(left), middle, ...qSort(right)];
}

console.log(qSort([5, 4, 3, 2, 1]));
