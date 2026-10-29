import {
  GraphQLError,
  Kind,
  type ASTVisitor,
  type DocumentNode,
  type FragmentDefinitionNode,
  type SelectionSetNode,
  type ValidationContext,
  type ValidationRule,
} from 'graphql';

export interface QueryCostLimits {
  /** Maximum aliased fields in one operation (fragments expanded). */
  maxAliases: number;
  /** Maximum field selections in one operation (fragments expanded). */
  maxFields: number;
}

export const DEFAULT_QUERY_COST_LIMITS: QueryCostLimits = {
  maxAliases: 20,
  maxFields: 500,
};

interface Cost {
  fields: number;
  aliases: number;
}

/**
 * Walks a selection set with fragments expanded. Each fragment is costed once and
 * memoised, so a fragment bomb (fragments spreading each other many times) is
 * measured in linear time. Cycles are cut off; NoFragmentCyclesRule reports them.
 */
function measureSelectionSet(
  selectionSet: SelectionSetNode,
  fragments: Map<string, FragmentDefinitionNode>,
  memo: Map<string, Cost>,
  visiting: Set<string>
): Cost {
  const total: Cost = { fields: 0, aliases: 0 };

  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      total.fields += 1;
      if (selection.alias) total.aliases += 1;
      if (selection.selectionSet) {
        const nested = measureSelectionSet(selection.selectionSet, fragments, memo, visiting);
        total.fields += nested.fields;
        total.aliases += nested.aliases;
      }
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      const nested = measureSelectionSet(selection.selectionSet, fragments, memo, visiting);
      total.fields += nested.fields;
      total.aliases += nested.aliases;
    } else {
      const name = selection.name.value;
      const fragment = fragments.get(name);
      if (!fragment || visiting.has(name)) continue;

      let cost = memo.get(name);
      if (!cost) {
        visiting.add(name);
        cost = measureSelectionSet(fragment.selectionSet, fragments, memo, visiting);
        visiting.delete(name);
        memo.set(name, cost);
      }
      total.fields += cost.fields;
      total.aliases += cost.aliases;
    }
  }

  return total;
}

export function measureDocument(document: DocumentNode): Cost[] {
  const fragments = new Map<string, FragmentDefinitionNode>();
  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.set(definition.name.value, definition);
    }
  }

  const memo = new Map<string, Cost>();
  const costs: Cost[] = [];
  for (const definition of document.definitions) {
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      costs.push(measureSelectionSet(definition.selectionSet, fragments, memo, new Set()));
    }
  }
  return costs;
}

/**
 * Bounds per-operation breadth (S05-01). depthLimit alone does not stop one
 * request from aliasing a DB-backed field thousands of times.
 */
export function createQueryCostRule(
  limits: QueryCostLimits = DEFAULT_QUERY_COST_LIMITS
): ValidationRule {
  return (context: ValidationContext): ASTVisitor => ({
    Document(document) {
      for (const cost of measureDocument(document)) {
        if (cost.aliases > limits.maxAliases) {
          context.reportError(
            new GraphQLError(
              `Operation uses ${cost.aliases} aliases, exceeding the limit of ${limits.maxAliases}.`
            )
          );
          return;
        }
        if (cost.fields > limits.maxFields) {
          context.reportError(
            new GraphQLError(
              `Operation selects ${cost.fields} fields, exceeding the limit of ${limits.maxFields}.`
            )
          );
          return;
        }
      }
    },
  });
}
