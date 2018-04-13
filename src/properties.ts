import * as properties from 'mdn-data/css/properties.json';
import {
  compatNames,
  compatSyntax,
  getCompat,
  getPropertyData,
  getTypesData,
  isAddedBySome,
  isDeprecated,
} from './compat';
import { createPropertyDataTypeResolver, resolveDataTypes } from './data-types';
import { properties as rawSvgProperties, syntaxes as svgSyntaxes } from './data/svg';
import parse from './parser';
import patchProperty from './patcher';
import typing, { ResolvedType } from './typer';

const IGNORES = [
  // Custom properties
  '--*',
  // We define this manually
  'all',
];

const REGEX_VENDOR_PROPERTY = /^-/;

interface IProperty {
  name: string;
  types: ResolvedType[];
}

const globalCompatibilityData = getTypesData('global_keywords');
if (!globalCompatibilityData) {
  throw new Error('Compatibility data for CSS-wide keywords is missing or may have been moved');
}

// The CSS-wide keywords are identical to the `all` property
// https://www.w3.org/TR/2016/CR-css-cascade-4-20160114/#all-shorthand
export const globals: ResolvedType[] = resolveDataTypes(
  typing(compatSyntax(globalCompatibilityData, parse(properties.all.syntax))),
);

export const standardLonghandProperties: { [name: string]: IProperty } = {};
export const standardShorthandProperties: { [name: string]: IProperty } = {
  // Empty so that it only receives CSS-wide keywords
  all: {
    name: 'all',
    types: [],
  },
};
export const vendorPrefixedLonghandProperties: { [name: string]: IProperty } = {};
export const vendorPrefixedShorthandProperties: { [name: string]: IProperty } = {};
export const obsoleteProperties: { [name: string]: IProperty } = {};
export const svgProperties: { [name: string]: IProperty } = {};

for (const originalName in properties) {
  if (IGNORES.includes(originalName)) {
    continue;
  }

  // Default values
  let entities = parse(properties[originalName].syntax);
  let currentNames: string[] = [originalName];
  let obsoleteNames: string[] = [];

  const compatibilityData = getPropertyData(originalName);

  if (compatibilityData) {
    const compat = getCompat(compatibilityData);

    if (!isAddedBySome(compat)) {
      // The property needs to be added by some browsers
      continue;
    }

    entities = compatSyntax(compatibilityData, entities);
    currentNames = currentNames.concat(filterMissingProperties(compatNames(compat, originalName)));
    obsoleteNames = obsoleteNames.concat(filterMissingProperties(compatNames(compat, originalName, true)));

    if (isDeprecated(compat)) {
      // Move all property names to obsolete
      obsoleteNames = obsoleteNames.concat(currentNames);
      currentNames = [];
    }
  }

  const property: IProperty = {
    name: originalName,
    types: patchProperty(
      originalName,
      resolveDataTypes(typing(entities), createPropertyDataTypeResolver(compatibilityData)),
    ),
  };

  for (const name of currentNames) {
    const isShorthand = Array.isArray(properties[originalName].computed);

    if (isVendorProperty(name)) {
      if (isShorthand) {
        vendorPrefixedShorthandProperties[name] = property;
      } else {
        vendorPrefixedLonghandProperties[name] = property;
      }
    } else {
      if (isShorthand) {
        standardShorthandProperties[name] = property;
      } else {
        standardLonghandProperties[name] = property;
      }
    }
  }

  for (const name of obsoleteNames) {
    obsoleteProperties[name] = property;
  }
}

for (const name in rawSvgProperties) {
  const compatibilityData = getPropertyData(name);
  const syntax = rawSvgProperties[name].syntax;
  if (syntax) {
    svgProperties[name] = {
      name,
      types: resolveDataTypes(typing(parse(syntax)), createSvgDataTypeResolver(compatibilityData)),
    };
  }
}

export function isVendorProperty(name: string) {
  return REGEX_VENDOR_PROPERTY.test(name);
}

function filterMissingProperties(names: string[]) {
  // Filter only those which isn't defined in MDN data
  return names.filter(name => !(name in properties));
}

function createSvgDataTypeResolver(data: MDN.CompatData | null) {
  const resolver = createPropertyDataTypeResolver(data);
  const svgResolver: (dataTypeName: string) => ResolvedType[] = (dataTypeName: string) =>
    dataTypeName in svgSyntaxes
      ? resolveDataTypes(typing(parse(svgSyntaxes[dataTypeName].syntax)), svgResolver)
      : resolver(dataTypeName);

  return svgResolver;
}
