import chalk from 'chalk';
import { getPropertyData } from './compat';
import { createPropertyDataTypeResolver, resolveDataTypes } from './data-types';
import { properties as propertyPatches } from './data/css-patches';
import parse from './parser';
import typing, { addType, hasType, ResolvedType, Type } from './typer';

export default function patchProperty(name: string, types: ResolvedType[]): ResolvedType[] {
  if (!(name in propertyPatches)) {
    // Nothing to patch
    return types;
  }

  const compatibilityData = getPropertyData(name);

  // Dissolve all data types to check whether it already exists or not
  const dissolvedTypes = resolveDataTypes(types, createPropertyDataTypeResolver(compatibilityData, Infinity), Infinity);
  const patchTypes = typing(parse(propertyPatches[name].syntax));

  let patchedTypes = types;

  for (const type of patchTypes) {
    if (!hasType(dissolvedTypes, type)) {
      patchedTypes = addType(patchedTypes, type);

      switch (type.type) {
        case Type.DataType:
          info('The property syntax patch with data type `<%s>` for property `%s` was added', type.name, name);
          break;
        case Type.Length:
          info('The property syntax patch with `<length>` for property `%s` was added', name);
          break;
        case Type.String:
          info('The property syntax patch resolved to `string` for property `%s` was added', name);
          break;
        case Type.Number:
          info('The property syntax patch resolved to `number` for property `%s` was added', name);
          break;
        case Type.NumericLiteral:
        case Type.StringLiteral:
          info('The property syntax patch with keyword `%s` for property `%s` was added', String(type.literal), name);
          break;
        default:
          info('A property syntax patch for property `%s` was added', name);
      }
    } else {
      switch (type.type) {
        case Type.DataType:
          error(
            'The property syntax patch with data type `<%s>` for property `%s` was ignored ' +
              'because it has been fixed permanently and must be removed',
            type.name,
            name,
          );
          break;
        case Type.Length:
          error(
            'The property syntax patch with `<length>` for property `%s` was ignored ' +
              'because it has been fixed permanently and must be removed',
            name,
          );
          break;
        case Type.String:
          error(
            'The property syntax patch resolved to `string` for property `%s` was ignored ' +
              'because it has been fixed permanently and must be removed',
            name,
          );
          break;
        case Type.Number:
          error(
            'The property syntax patch resolved to `number` for property `%s` was ignored ' +
              'because it has been fixed permanently and must be removed',
            name,
          );
          break;
        case Type.NumericLiteral:
        case Type.StringLiteral:
          error(
            'The property syntax patch with keyword `%s` for property `%s` was ignored ' +
              'because it has been fixed permanently and must be removed',
            String(type.literal),
            name,
          );
          break;
        default:
          error(
            'A property syntax patch for property `%s` was ignored because it has been fixed ' +
              'permanently and must be removed',
            name,
          );
      }
    }
  }

  return patchedTypes;
}

const error: typeof console.error = (message, ...params) => {
  // Complete the build process but exit with failure when done
  process.exitCode = 1;
  console.error(chalk.magenta('ERROR! ' + message), ...params);
};

const info: typeof console.info = (message, ...params) => {
  console.info(chalk.cyan(message), ...params);
};
