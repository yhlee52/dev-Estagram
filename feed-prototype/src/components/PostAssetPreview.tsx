import type { PostAsset } from '../types/feed';
import AssetRenderer from './AssetRenderer';

type PostAssetPreviewProps = {
  asset?: PostAsset;
  variant?: 'preview' | 'full';
};

export default function PostAssetPreview({
  asset,
  variant = 'preview',
}: PostAssetPreviewProps) {
  return <AssetRenderer asset={asset} variant={variant} />;
}
