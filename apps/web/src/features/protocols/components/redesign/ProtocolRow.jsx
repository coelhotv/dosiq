import ProtocolRowTabular from './ProtocolRowTabular'
import ProtocolRowCard from './ProtocolRowCard'

export default function ProtocolRow({
  item,
  isComplex,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  activeTab,
  variant = 'card',
  isHovered = false,
  onRowMouseEnter,
  onRowMouseLeave,
  onRowClick,
}) {
  const showAdherence = activeTab === 'ativos'

  if (variant === 'tabular') {
    return (
      <ProtocolRowTabular
        item={item}
        showAdherence={showAdherence}
        isHovered={isHovered}
        onRowMouseEnter={onRowMouseEnter}
        onRowMouseLeave={onRowMouseLeave}
        onRowClick={onRowClick}
        onDelete={onDelete}
      />
    )
  }

  return (
    <ProtocolRowCard
      item={item}
      isComplex={isComplex}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      onEdit={onEdit}
      onDelete={onDelete}
      showAdherence={showAdherence}
    />
  )
}
