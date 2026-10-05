import json,pathlib
from jsonschema import Draft202012Validator
root=pathlib.Path(__file__).resolve().parents[1]
schema=json.loads((root/'packages/contracts/analysis.schema.json').read_text())
Draft202012Validator.check_schema(schema)
api=json.loads((root/'packages/contracts/openapi.json').read_text())
assert api['openapi']=='3.1.0'
ops=[op['operationId'] for path in api['paths'].values() for op in path.values()]
assert len(ops)==len(set(ops))
langs=[json.loads((root/f'apps/web/messages/{l}.json').read_text()) for l in ('en','pl','de')]
assert all(set(x)==set(langs[0]) for x in langs)
print('Analysis schema, API operation IDs and locale key parity passed')
