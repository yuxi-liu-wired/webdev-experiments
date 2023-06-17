import socket
import requests

url = "https://en.wikipedia.org/wiki/Web_Server_Gateway_Interface"
response = requests.get(url)
# Ensure we successfully fetched the page
response.raise_for_status()
# Store the page content as a string
page_content = response.text



def handle_request(request):
    with open('index.html', 'r') as f:
        file_content = f.read()
    response = 'HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n' + file_content
    response = 'HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n' + page_content
    # \r\n instead of \n, because [rfc2616](https://www.rfc-editor.org/rfc/rfc2616) says:
    # > CR LF as the end-of-line marker for all protocol elements except the entity-body
    return response

if __name__ == "__main__":
    print("WSIG is running...")
    
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        # SO_REUSEADDR makes the socket reusable
        s.bind(('localhost', 8000))
        s.listen(1)

        while True:
            conn, addr = s.accept()
            with conn:
                print(f'Connected by {addr}')
                request = conn.recv(1024).decode('utf-8')
                print(f'Received request: {request}')
                response = handle_request(request)
                conn.sendall(response.encode('utf-8'))

