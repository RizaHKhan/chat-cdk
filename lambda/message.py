import json

def handler(event, context):

    print("***Processing message")
    body = json.loads(event['body'])
    print(body)
    message = body.get('message')
    print(message)
    print(message.get('user'))
    print(message.get('message'))
    print("***End of message")

    print("***Processing context")
    print(context)
    print("***End of context")

    return {"statusCode": 200, "body": "Message"}
