/**
 * Error utility.
 *
 * Wraps a promise and returns a tuple `[error, data]`.
 *
 * Reference:
 * - Learnt it form Web Dev Simplified: https://youtu.be/AdmGHwvgaVs
 *
 * Notes:
 * - This is a golang style error handling, I like it, so I use it in Javascript.
 /

 /*
 * @template T
 * @param {Promise<T>} promise
 * @returns {Promise<[unknown, T | undefined]>}
 */
export default function errorUtils(promise) {
	return promise
		.then((data) => [undefined, data])
		.catch((error) => [error, undefined]);
}
