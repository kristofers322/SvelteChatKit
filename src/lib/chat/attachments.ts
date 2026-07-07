import type { ChatAttachment } from './types.js';
import { ChatProviderError, generateId } from './types.js';

/** Recommended per-file cap. localStorage holds ~5MB total, so keep files small. */
export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

/** Reads a File into a ChatAttachment (base64 data URL). */
export function fileToAttachment(file: File): Promise<ChatAttachment> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(new Error(`Could not read "${file.name}".`));
		reader.onload = () => {
			resolve({
				id: generateId(),
				name: file.name,
				mimeType: file.type || 'application/octet-stream',
				size: file.size,
				dataUrl: reader.result as string
			});
		};
		reader.readAsDataURL(file);
	});
}

export function isImage(attachment: ChatAttachment): boolean {
	return attachment.mimeType.startsWith('image/');
}

/** Converts an attachment's data URL back into a Blob (for multipart uploads). */
export function attachmentToBlob(attachment: ChatAttachment): Blob {
	const comma = attachment.dataUrl.indexOf(',');
	if (comma === -1) {
		throw new ChatProviderError('attachments', `Attachment "${attachment.name}" has no data.`);
	}
	const base64 = attachment.dataUrl.slice(comma + 1);
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return new Blob([bytes], { type: attachment.mimeType });
}

/** The base64 payload of a data URL, without the "data:...;base64," prefix. */
export function attachmentBase64(attachment: ChatAttachment): string {
	const comma = attachment.dataUrl.indexOf(',');
	if (comma === -1) {
		throw new ChatProviderError('attachments', `Attachment "${attachment.name}" has no data.`);
	}
	return attachment.dataUrl.slice(comma + 1);
}
