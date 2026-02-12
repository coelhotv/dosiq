import Calendar from './Calendar'

/**
 * @deprecated Use Calendar com props enableLazyLoad=true, enableSwipe=true, enableMonthPicker=true
 * 
 * CalendarWithMonthCache foi consolidado no componente Calendar.
 * 
 * Migração:
 * Antes:
 *   <CalendarWithMonthCache 
 *     onLoadMonth={handleLoadMonth}
 *     markedDates={markedDates}
 *     selectedDate={selectedDate}
 *     onDayClick={handleDayClick}
 *   />
 * 
 * Depois:
 *   <Calendar 
 *     enableLazyLoad={true}
 *     enableSwipe={true}
 *     enableMonthPicker={true}
 *     onLoadMonth={handleLoadMonth}
 *     markedDates={markedDates}
 *     selectedDate={selectedDate}
 *     onDayClick={handleDayClick}
 *   />
 */
export default function CalendarWithMonthCache({
  onLoadMonth,
  markedDates = [],
  selectedDate,
  onDayClick
}) {
  // Redirect para Calendar com features ativadas
  return (
    <Calendar
      enableLazyLoad={true}
      enableSwipe={true}
      enableMonthPicker={true}
      onLoadMonth={onLoadMonth}
      markedDates={markedDates}
      selectedDate={selectedDate}
      onDayClick={onDayClick}
    />
  )
}
