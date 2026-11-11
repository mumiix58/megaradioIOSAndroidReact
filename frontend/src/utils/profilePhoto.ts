export function profilePhotoFile(asset:{uri:string;fileName?:string|null;mimeType?:string|null;fileSize?:number;file?:{size:number;type?:string}}){
 if((asset.fileSize??asset.file?.size??0)>5*1024*1024)throw Error('avatar_file_size');
 const name=asset.fileName||asset.uri.split('/').pop()?.split('?')[0]||'avatar.jpg';
 const extension=name.split('.').pop()?.toLowerCase();
 const type=asset.mimeType||asset.file?.type||(extension==='png'?'image/png':extension==='webp'?'image/webp':'image/jpeg');
 if(!['image/jpeg','image/png','image/webp'].includes(type))throw Error('avatar_file_type');
 return {name,type};
}
