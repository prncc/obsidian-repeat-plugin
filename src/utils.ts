/**
 * Produces array without duplicate "field" values.
 * @param array An array of objects, each of which has "field" property.
 * @param field The property used to determine which elements to keep.
 * @returns Array with objects without duplicate "field" values.
 */
export function uniqByField(array: any[], field: string): any[] {
  return [...array.reduce((map: Map<any, any>, item: any) => {
    const key = (item == null) ? item : item[field];
    if (!map.has(key)) { map.set(key, item); }
    return map;
  }, new Map()).values()];
}
