export async function getZip(data, fileName, type = 'blob') {
	const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'));
	const zippedData = await new Response(stream).arrayBuffer();
	return type === 'blob'
		? new Blob([zippedData], { type: 'application/gzip' })
		: new Uint8Array(zippedData);
}

export async function readZip(data) {
	const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
	const view = new DataView(buffer);
	const signature = view.getUint32(0, false);
	let decompressedText = '';

	if ((signature >>> 16) === 0x1f8b) {
		const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
		decompressedText = await new Response(stream).text();
	} else if (signature === 0x504b0304) {
		const nameLen = view.getUint16(26, true);
		const extraLen = view.getUint16(28, true);
		const dataOffset = 30 + nameLen + extraLen;
		const compressedSize = view.getUint32(18, true);
		let compressedData;

		if (compressedSize > 0) {
			compressedData = buffer.slice(dataOffset, dataOffset + compressedSize);
		} else {
			const uint8 = new Uint8Array(buffer);
			let cdOffset = -1;
			for (let i = dataOffset; i < uint8.length - 4; i += 1) {
				if (
					uint8[i] === 0x50 &&
					uint8[i + 1] === 0x4b &&
					uint8[i + 2] === 0x01 &&
					uint8[i + 3] === 0x02
				) {
					cdOffset = i;
					break;
				}
			}
			compressedData = cdOffset > 0 ? buffer.slice(dataOffset, cdOffset) : buffer.slice(dataOffset);
		}

		try {
			const ds = new DecompressionStream('deflate-raw');
			const stream = new Blob([compressedData]).stream().pipeThrough(ds);
			decompressedText = await new Response(stream).text();
		} catch (error) {
			const ds = new DecompressionStream('deflate');
			const stream = new Blob([compressedData]).stream().pipeThrough(ds);
			decompressedText = await new Response(stream).text();
		}
	} else {
		decompressedText = new TextDecoder().decode(buffer);
	}

	const parsedData = JSON.parse(decompressedText);
	return [{ name: 'backup.json', value: decompressedText, data: parsedData }];
}
