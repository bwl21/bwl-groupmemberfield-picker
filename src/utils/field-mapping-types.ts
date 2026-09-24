/**
 * Field Selection Configuration Types
 * Configuration for which fields to copy from source groups to target group
 * 
 * Note: Kept minimal to stay within 1000 character limit
 */

export interface SelectedField {
  sourceGroupId: number;
  sourceGroupName: string;
  fieldId: number;
  fieldName: string;
  fieldType: string;
  selected: boolean;
}

export interface FieldSelectionConfiguration {
  version: string;
  targetGroupId: number;
  selectedFields: SelectedField[];
  sourceGroupIds?: number[]; // Optional for compatibility with existing configurations
  lastUpdated: string;  // ISO date
}

/**
 * Compact version for storage (minimal data)
 */
interface CompactSelectedField {
  g: number;  // sourceGroupId
  f: number;  // fieldId
}

interface CompactConfiguration {
  v: string;  // version
  t: number;  // targetGroupId
  s: CompactSelectedField[];  // selectedFields
  g?: number[]; // Additional source groups without selected fields
  u: string;  // lastUpdated
}

/**
 * Parse configuration from JSON string
 * Supports both compact and full format
 */
export function parseConfiguration(json: string): FieldSelectionConfiguration | null {
  try {
    const data = JSON.parse(json);
    
    // Check if it's compact format
    if ('v' in data && 't' in data && 's' in data) {
      const compact = data as CompactConfiguration;
      // Expand compact format to full format
      return {
        version: compact.v,
        targetGroupId: compact.t,
        sourceGroupIds: [...new Set([...(compact.g ?? []), ...compact.s.map(sf => sf.g)])],
        selectedFields: compact.s.map(sf => ({
          sourceGroupId: sf.g,
          sourceGroupName: '', // Will be filled when loading
          fieldId: sf.f,
          fieldName: '', // Will be filled when loading
          fieldType: '', // Will be filled when loading
          selected: true,
        })),
        lastUpdated: compact.u,
      };
    }
    
    // Full format
    if (!data.version || typeof data.targetGroupId !== 'number' || !Array.isArray(data.selectedFields)) {
      return null;
    }
    return data as FieldSelectionConfiguration;
  } catch (error) {
    console.error('Error parsing configuration:', error);
    return null;
  }
}

/**
 * Create a new empty configuration
 */
export function createEmptyConfiguration(targetGroupId: number): FieldSelectionConfiguration {
  return {
    version: '1.0',
    targetGroupId,
    selectedFields: [],
    sourceGroupIds: [],
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Serialize configuration to JSON string (compact format to save space)
 * Uses short property names to minimize size
 */
export function serializeConfiguration(config: FieldSelectionConfiguration): string {
  // Convert to compact format
  const compact: CompactConfiguration = {
    v: config.version,
    t: config.targetGroupId,
    s: config.selectedFields.map(sf => ({
      g: sf.sourceGroupId,
      f: sf.fieldId,
    })),
    u: config.lastUpdated,
  };
  
  const groupsWithFields = new Set(config.selectedFields.map(sf => sf.sourceGroupId));
  const additionalGroups = getSourceGroupIds(config).filter(id => !groupsWithFields.has(id));
  if (additionalGroups.length > 0) compact.g = additionalGroups;

  const json = JSON.stringify(compact);
  
  console.log('Configuration size:', json.length, 'characters (limit: 1000)');
  
  if (json.length > 1000) {
    console.error('❌ Configuration exceeds 1000 characters!', json.length);
    throw new Error(`Konfiguration ist zu groß (${json.length} Zeichen, Maximum: 1000). Bitte wählen Sie weniger Felder aus.`);
  }
  
  return json;
}

/** Legacy configurations already identify each field's source group. */
export function getSourceGroupIds(config: FieldSelectionConfiguration): number[] {
  return [...new Set([...(config.sourceGroupIds ?? []), ...config.selectedFields.map(sf => sf.sourceGroupId)])];
}
