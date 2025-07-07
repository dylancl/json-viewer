import { JsonNode, SearchResult } from "@/types/json";

export function deepCopyJsonNode(
  node: JsonNode,
  newParent?: JsonNode
): JsonNode {
  const newNode: JsonNode = {
    key: node.key,
    value: node.value,
    type: node.type,
    path: [...node.path],
    depth: node.depth,
    isExpanded: node.isExpanded,
    parent: newParent,
    index: node.index,
  };

  if (node.children) {
    newNode.children = node.children.map((child) =>
      deepCopyJsonNode(child, newNode)
    );
  }

  return newNode;
}

export function expandPathsInNode(
  node: JsonNode,
  pathsToExpand: Set<string>,
  newParent?: JsonNode
): JsonNode {
  const actualPath = node.path.length > 0 ? node.path : [];
  const nodePathString = JSON.stringify(actualPath);
  const shouldForceExpand = pathsToExpand.has(nodePathString);

  const newNode: JsonNode = {
    key: node.key,
    value: node.value,
    type: node.type,
    path: [...node.path],
    depth: node.depth,
    isExpanded: shouldForceExpand ? true : node.isExpanded,
    parent: newParent,
    index: node.index,
  };

  if (node.children) {
    newNode.children = node.children.map((child) =>
      expandPathsInNode(child, pathsToExpand, newNode)
    );
  }

  return newNode;
}

export function resetNodeExpansion(
  node: JsonNode,
  newParent?: JsonNode
): JsonNode {
  const newNode: JsonNode = {
    key: node.key,
    value: node.value,
    type: node.type,
    path: [...node.path],
    depth: node.depth,
    isExpanded: node.depth < 2,
    parent: newParent,
    index: node.index,
  };

  if (node.children) {
    newNode.children = node.children.map((child) =>
      resetNodeExpansion(child, newNode)
    );
  }

  return newNode;
}

export function setAllNodesExpanded(
  node: JsonNode,
  expanded: boolean,
  newParent?: JsonNode
): JsonNode {
  const newNode: JsonNode = {
    key: node.key,
    value: node.value,
    type: node.type,
    path: [...node.path],
    depth: node.depth,
    isExpanded: expanded,
    parent: newParent,
    index: node.index,
  };

  if (node.children) {
    newNode.children = node.children.map((child) =>
      setAllNodesExpanded(child, expanded, newNode)
    );
  }

  return newNode;
}

export function getPathsToExpand(results: SearchResult[]): Set<string> {
  const pathsToExpand = new Set<string>();

  results.forEach((result) => {
    for (let i = 0; i <= result.path.length; i++) {
      const parentPath = result.path.slice(0, i);
      pathsToExpand.add(JSON.stringify(parentPath));
    }
  });

  return pathsToExpand;
}

export function toggleNodeAtPath(
  node: JsonNode,
  targetPath: string[]
): JsonNode {
  function findAndToggle(
    currentNode: JsonNode,
    currentPath: string[] = []
  ): JsonNode {
    if (
      currentPath.length === targetPath.length &&
      JSON.stringify(currentPath) === JSON.stringify(targetPath)
    ) {
      return { ...currentNode, isExpanded: !currentNode.isExpanded };
    }

    if (currentNode.children) {
      const newChildren = currentNode.children.map((child) => {
        const childPath = child.key ? [...currentPath, child.key] : currentPath;
        return findAndToggle(child, childPath);
      });
      return { ...currentNode, children: newChildren };
    }

    return currentNode;
  }

  const copiedNode = deepCopyJsonNode(node);
  return findAndToggle(copiedNode);
}
