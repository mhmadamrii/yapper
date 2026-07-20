function bubbleSort(arr: number[]): number[] {
  const len = arr.length

  for (let i = 0; i < len - 1; i++) {
    for (let j = 0; j < len - 1; j++) {
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j+1], arr[j]]
      }
  }
  }
  return arr
}

function schoolScanner(arr: number[]): number {
  const original = []

  for (const a of arr) {
    if (original.some(v => v == a)) {
      console.log('a value is ->', a)
    } else {
      original.push(a)
    }
  }

  console.log('original lists', original)

  if (original.length > 1) {
    return original[0]
  } else {
    return -1
  }
}

function quickSort(arr: number[]): number[] {
  const pivot = arr[arr.length - 1]
  console.log('the pivot is', pivot)

  return arr
}


console.log(bubbleSort([1, 4, 3, 2]))
console.log('school scanner correct', schoolScanner([1, 4, 3, 2]))
console.log(schoolScanner([201, 101, 201, 400]))
console.log(quickSort([201, 101, 201, 400]))


