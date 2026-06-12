import type { MetadataValue, PostAsset } from '../types/feed';

export type VisualAsset = PostAsset & {
  type: 'image' | 'plot';
};

type SortableVisualAsset = {
  asset: VisualAsset;
  originalIndex: number;
};

export function getAssetUrl(asset: PostAsset): string | undefined {
  return asset.url ?? asset.src;
}

export function isVisualAsset(asset: PostAsset | undefined): asset is VisualAsset {
  return asset?.type === 'image' || asset?.type === 'plot';
}

function getNumericMetadataValue(value: MetadataValue | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function getStringMetadataValue(value: MetadataValue | undefined): string {
  return typeof value === 'string' ? value : '';
}

function getSortOrder(asset: PostAsset): number | undefined {
  if (typeof asset.sort_order === 'number' && Number.isFinite(asset.sort_order)) {
    return asset.sort_order;
  }

  return getNumericMetadataValue(asset.metadata?.sort_order);
}

function getCreatedAt(asset: PostAsset): string {
  return getStringMetadataValue(asset.metadata?.created_at);
}

function compareVisualAssets(
  left: SortableVisualAsset,
  right: SortableVisualAsset,
): number {
  const leftSortOrder = getSortOrder(left.asset);
  const rightSortOrder = getSortOrder(right.asset);
  const leftHasSortOrder = leftSortOrder !== undefined;
  const rightHasSortOrder = rightSortOrder !== undefined;

  if (leftHasSortOrder && rightHasSortOrder && leftSortOrder !== rightSortOrder) {
    return leftSortOrder - rightSortOrder;
  }

  if (leftHasSortOrder !== rightHasSortOrder) {
    return leftHasSortOrder ? -1 : 1;
  }

  const createdAtCompare = getCreatedAt(left.asset).localeCompare(
    getCreatedAt(right.asset),
  );
  if (createdAtCompare !== 0) {
    return createdAtCompare;
  }

  const idCompare = (left.asset.id ?? '').localeCompare(right.asset.id ?? '');
  if (idCompare !== 0) {
    return idCompare;
  }

  return left.originalIndex - right.originalIndex;
}

export function getSortedVisualAssets(assets: PostAsset[] | undefined): VisualAsset[] {
  return (assets ?? [])
    .map((asset, originalIndex) => ({ asset, originalIndex }))
    .filter(
      (item): item is SortableVisualAsset => isVisualAsset(item.asset),
    )
    .sort(compareVisualAssets)
    .map((item) => item.asset);
}
